/**
 * Utility untuk parse pesan / embed dari FlaviBot dan mengekstrak info lagu
 *
 * FlaviBot menggunakan Discord Components V2 (Container, Section, TextDisplay)
 * dan terkadang Embeds tradisional:
 * - Components:
 *   - Type 17: ContainerComponent
 *   - Type 10: TextDisplayComponent (content: "### [Now playing](...)" dan "**[Queen - Bohemian Rhapsody](url)**")
 *   - Type 9: SectionComponent
 *   - Type 1: ActionRow dengan Buttons (Pause, Skip, Stop, dll.)
 */

/**
 * Ekstrak semua string teks dari Discord message components secara rekursif
 * @param {Array} components
 * @returns {string[]}
 */
function extractAllTextsFromComponents(components) {
  const texts = [];
  function traverse(items) {
    if (!items || !Array.isArray(items)) return;
    for (const item of items) {
      const content = item.data?.content || item.content;
      if (content && typeof content === 'string') {
        texts.push(content);
      }
      if (item.components && Array.isArray(item.components)) {
        traverse(item.components);
      }
    }
  }
  traverse(components);
  return texts;
}

/**
 * Cek apakah baris teks adalah progress bar atau durasi waktu
 */
function isProgressBarOrTime(line) {
  if (!line) return false;
  if (line.includes('🔘') || /[─━\-_]{3,}/.test(line)) return true;
  if (/^\s*\d{1,2}:\d{2}/.test(line)) return true;
  return false;
}

/**
 * Cek apakah baris teks adalah metadata / system text FlaviBot
 */
function isSystemOrMetaLine(line) {
  if (!line) return false;
  const lower = line.toLowerCase().trim();
  return (
    lower.startsWith('queue size') ||
    lower.startsWith('volume') ||
    lower.startsWith('loop') ||
    lower.startsWith('added by') ||
    lower.startsWith('- added by') ||
    lower.startsWith('•') ||
    lower.startsWith('now playing') ||
    lower.startsWith('sedang diputar') ||
    lower.startsWith('playing now') ||
    lower.includes('left the voice channel') ||
    lower.includes('due to inactivity') ||
    lower.includes('dashboard') ||
    lower.includes('website') ||
    lower.includes('vote') ||
    lower.includes('invite')
  );
}

/**
 * Parse lagu dari Discord Components V2 (FlaviBot Player baru)
 * @param {import('discord.js').Message} message
 * @returns {{ title: string, artist: string|null, imageUrl: string|null } | null}
 */
function parseFromComponents(message) {
  if (!message.components || message.components.length === 0) return null;

  const texts = extractAllTextsFromComponents(message.components);
  if (texts.length === 0) return null;

  const allText = texts.join('\n').toLowerCase();

  // 1. Tolak jika ada pesan status sistem
  if (
    allText.includes('left the voice channel') ||
    allText.includes('due to inactivity') ||
    allText.includes('nothing is playing')
  ) {
    return null;
  }

  // 2. Cek apakah ini pemutar musik FlaviBot
  const isMusicPlayer =
    allText.includes('now playing') ||
    allText.includes('queue size') ||
    allText.includes('volume:') ||
    allText.includes('volume :') ||
    message.components.some(row =>
      (row.components || []).some(btn =>
        ['pause', 'skip', 'stop', 'autoplay', 'love this'].includes((btn.label || btn.data?.label || '').toLowerCase())
      )
    );

  if (!isMusicPlayer) return null;

  // 3. Ekstrak judul lagu dari markdown link di dalam teks komponen
  for (const text of texts) {
    // Format: **[Queen - Bohemian Rhapsody](url)** atau [Title - Artist](url)
    const match = text.match(/\[([^\]]+)\]\([^)]+\)/);
    if (match) {
      const linkText = match[1].trim();
      const lower = linkText.toLowerCase();

      // Skip link non-lagu seperti [Now playing](...) atau [Dashboard](...)
      if (
        lower === 'now playing' ||
        lower.includes('dashboard') ||
        lower.includes('website') ||
        lower.includes('music-player') ||
        lower.includes('click here') ||
        lower.includes('vote')
      ) {
        continue;
      }

      const parsed = parseSongString(linkText);
      if (parsed && parsed.title) {
        return {
          title: parsed.title,
          artist: parsed.artist,
          imageUrl: null,
        };
      }
    }
  }

  return null;
}

/**
 * Cek apakah embed/message ini adalah "Now Playing" / Music Player dari FlaviBot
 * @param {import('discord.js').Embed} [embed]
 * @param {import('discord.js').Message} [message]
 * @returns {boolean}
 */
function isNowPlayingEmbed(embed, message) {
  // Jika message punya Components V2 dari FlaviBot
  if (message && message.components && message.components.length > 0) {
    if (parseFromComponents(message) !== null) return true;
  }

  if (!embed) return false;

  const title = (embed.title || '').trim();
  const authorName = (embed.author?.name || '').trim();
  const desc = (embed.description || '').trim();
  const allText = `${title}\n${authorName}\n${desc}`.toLowerCase();

  // 1. Filter out pesan system / error / status non-lagu dari FlaviBot
  const systemKeywords = [
    'left the voice channel',
    'due to inactivity',
    'queue is empty',
    'nothing is playing',
    'nothing is currently playing',
    'disconnected',
    'connected to',
    'joined the voice',
    'error occurred',
  ];
  if (systemKeywords.some(keyword => allText.includes(keyword))) {
    return false;
  }

  // 2. Indikator positif bahwa ini adalah card pemutar musik FlaviBot
  if (
    allText.includes('now playing') ||
    allText.includes('sedang diputar') ||
    allText.includes('playing now') ||
    allText.includes('queue size') ||
    allText.includes('volume:') ||
    allText.includes('volume :') ||
    allText.includes('added by') ||
    allText.includes('loop:') ||
    desc.includes('🔘') ||
    /[─━]{3,}/.test(desc)
  ) {
    return true;
  }

  // 3. Cek button player di message components
  if (message?.components) {
    const hasPlayerButton = message.components.some(row =>
      (row.components || []).some(btn => {
        const label = (btn.label || btn.data?.label || '').toLowerCase();
        return ['pause', 'skip', 'stop', 'autoplay', 'dashboard'].includes(label);
      })
    );
    if (hasPlayerButton) return true;
  }

  return false;
}

/**
 * Ekstrak info lagu dari pesan FlaviBot (Mendukung Components V2 DAN Embeds)
 * @param {import('discord.js').Message} message
 * @returns {{ title: string, artist: string|null, imageUrl: string|null } | null}
 */
function parseFlaviBotEmbed(message) {
  if (!message) return null;

  // 1. Coba parse dari Discord Components V2 terlebih dahulu (format FlaviBot modern)
  const fromComponents = parseFromComponents(message);
  if (fromComponents) return fromComponents;

  // 2. Fallback: coba parse dari Embeds tradisional
  if (message.embeds && message.embeds.length > 0) {
    for (const embed of message.embeds) {
      if (!isNowPlayingEmbed(embed, message)) continue;

      const result = parseNowPlayingEmbed(embed);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Parse embed tradisional FlaviBot
 * @param {import('discord.js').Embed} embed
 * @returns {{ title: string, artist: string|null, imageUrl: string|null } | null}
 */
function parseNowPlayingEmbed(embed) {
  const imageUrl = embed.image?.url || embed.thumbnail?.url || null;

  // Prioritas 1: Markdown link di description
  if (embed.description) {
    const linkMatch = embed.description.match(/\[([^\]]+)\]\([^)]+\)/);
    if (linkMatch) {
      const linkText = linkMatch[1].trim();
      const lower = linkText.toLowerCase();
      if (
        linkText.length >= 2 &&
        lower !== 'now playing' &&
        !lower.includes('dashboard') &&
        !lower.includes('vote') &&
        !lower.includes('support') &&
        !lower.includes('invite') &&
        !lower.includes('website') &&
        !lower.includes('link')
      ) {
        const parsed = parseSongString(linkText);
        if (parsed) return { title: parsed.title, artist: parsed.artist, imageUrl };
      }
    }
  }

  // Prioritas 2: Title embed jika bukan generic
  if (embed.title) {
    const lowerTitle = embed.title.toLowerCase().trim();
    if (
      !lowerTitle.includes('now playing') &&
      !lowerTitle.includes('sedang diputar') &&
      !lowerTitle.includes('playing now') &&
      !lowerTitle.includes('queue') &&
      !lowerTitle.includes('error') &&
      embed.title.trim().length >= 2
    ) {
      const parsed = parseSongString(embed.title);
      if (parsed) return { title: parsed.title, artist: parsed.artist, imageUrl };
    }
  }

  // Prioritas 3: Baris plain text di description
  if (embed.description) {
    const lines = embed.description.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;
      if (isSystemOrMetaLine(trimmed)) continue;
      if (isProgressBarOrTime(trimmed)) continue;
      if (trimmed.startsWith('*') || trimmed.startsWith('>') || trimmed.startsWith('|')) continue;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) continue;

      const parsed = parseSongString(trimmed);
      if (parsed && parsed.title.length >= 2) {
        return { title: parsed.title, artist: parsed.artist, imageUrl };
      }
    }
  }

  // Prioritas 4: Fields embed
  if (embed.fields) {
    for (const field of embed.fields) {
      const lowerName = field.name.toLowerCase();
      if (
        lowerName.includes('title') ||
        lowerName.includes('song') ||
        lowerName.includes('track')
      ) {
        const parsed = parseSongString(field.value);
        if (parsed) return { title: parsed.title, artist: parsed.artist, imageUrl };
      }
    }
  }

  return null;
}

/**
 * Parse string format "Artist - Title" atau "Title"
 * @param {string} text
 * @returns {{ title: string, artist: string|null } | null}
 */
function parseSongString(text) {
  if (!text || text.trim().length < 2) return null;

  let cleaned = cleanText(text);

  // Hapus prefix umum
  cleaned = cleaned
    .replace(/^(now\s*playing\s*[:：]?\s*)/i, '')
    .replace(/^(playing\s*[:：]?\s*)/i, '')
    .replace(/^(sedang\s*diputar\s*[:：]?\s*)/i, '')
    .replace(/^(🎵|🎶|🎧|🎤|♪|♫)\s*/g, '')
    .trim();

  if (!cleaned || cleaned.length < 2) return null;

  // Coba split dengan " - ", " – ", " — "
  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const part1 = cleaned.substring(0, idx).trim();
      const part2 = cleaned.substring(idx + sep.length).trim();

      if (part1 && part2) {
        // Format biasanya: Artist - Title
        return { title: part2, artist: part1 };
      }
    }
  }

  // Coba "by" pattern: "Title by Artist"
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }

  // Tidak ada separator, return sebagai title saja
  return { title: cleaned, artist: null };
}

/**
 * Bersihkan text dari markdown, emoji, dan whitespace berlebih
 */
function cleanText(text) {
  return text
    .replace(/\*\*/g, '')          // bold
    .replace(/\*/g, '')            // italic
    .replace(/__/g, '')            // underline
    .replace(/~~/g, '')            // strikethrough
    .replace(/`/g, '')             // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
    .replace(/\s+/g, ' ')         // multiple spaces
    .trim();
}

/**
 * Cek apakah pesan FlaviBot menandakan pemutaran berhenti / antrean habis
 * Dipakai untuk membersihkan lirik lagu sebelumnya.
 * @param {import('discord.js').Message} message
 * @returns {boolean}
 */
function isPlaybackEndMessage(message) {
  if (!message) return false;

  const parts = [];

  if (message.components && message.components.length > 0) {
    parts.push(...extractAllTextsFromComponents(message.components));
  }

  if (message.embeds && message.embeds.length > 0) {
    for (const embed of message.embeds) {
      if (embed.title) parts.push(embed.title);
      if (embed.author?.name) parts.push(embed.author.name);
      if (embed.description) parts.push(embed.description);
      if (embed.footer?.text) parts.push(embed.footer.text);
      if (embed.fields) {
        for (const field of embed.fields) {
          parts.push(field.name, field.value);
        }
      }
    }
  }

  if (parts.length === 0) return false;

  const allText = parts.join('\n').toLowerCase();

  const endKeywords = [
    'left the voice channel',
    'due to inactivity',
    'queue is empty',
    'queue ended',
    'nothing is playing',
    'nothing is currently playing',
    'disconnected',
    'stopped playing',
  ];

  return endKeywords.some(keyword => allText.includes(keyword));
}

module.exports = {
  parseFlaviBotEmbed,
  parseSongString,
  cleanText,
  isNowPlayingEmbed,
  extractAllTextsFromComponents,
  isPlaybackEndMessage,
};
