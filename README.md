# 🎵 FlaviBot Lyrics Bot

Bot Discord untuk menampilkan lirik lagu bersinkronisasi (synced lyrics dengan timestamp) secara otomatis untuk lagu yang sedang diputar oleh **FlaviBot** di Discord.

Dilengkapi fitur transliterasi otomatis **Romaji (Alfabet)** untuk lagu-lagu berbahasa Jepang (Anime / J-Pop)!

---

## ✨ Fitur Utama

- 🎧 **Auto-Detect FlaviBot**: Otomatis mendeteksi lagu yang sedang berputar di voice channel dari FlaviBot (termasuk layout Discord Components V2 terbaru).
- ⏱ **Synced Lyrics**: Lirik berformat timestamp rapi per baris (`[mm:ss]`) sehingga mudah dinyanyikan mengikuti musik.
- 🔤 **Auto-Romaji**: Otomatis mengubah huruf Kanji/Kana pada lagu Jepang menjadi huruf alfabet latin (Romaji).
- 🔘 **Tombol Interaktif**: Tombol `🇯🇵 Tampilkan Kanji Asli` dan `🔤 Ubah ke Romaji` untuk beralih tampilan lirik secara instan.
- 🔍 **Manual Search**: Command `/lyrics [judul lagu]` untuk mencari lirik lagu apa saja secara fleksibel.
- 🌐 **Global Multi-Server**: Bisa digunakan di berbagai server Discord secara independen.
- 🆓 **100% Gratis**: Menggunakan database lirik terbuka [LRCLIB](https://lrclib.net/) tanpa batasan API key / paywall.

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Prasyarat
- [Node.js](https://nodejs.org/) versi 18 ke atas.
- Discord Bot Token & Client ID dari [Discord Developer Portal](https://discord.com/developers/applications).

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi di dalam file `.env`:
```env
DISCORD_TOKEN=token_bot_kamu_di_sini
CLIENT_ID=client_id_bot_kamu
FLAVIBOT_ID=684773505157431347
GUILD_ID=opsional_id_server_untuk_deploy_lokal
```

> ⚠️ **PENTING**: Jangan pernah mengunggah atau membagikan file `.env` ke publik (file ini sudah otomatis diabaikan oleh `.gitignore`).

### 4. Pastikan Gateway Intents Aktif di Discord Portal
Di [Discord Developer Portal](https://discord.com/developers/applications) ➔ **Bot** ➔ **Privileged Gateway Intents**:
- [x] **MESSAGE CONTENT INTENT** (Wajib AKTIF)
- [x] **SERVER MEMBERS INTENT**

### 5. Daftarkan Slash Command (`/lyrics`)
- **Untuk server lokal (Instan):**
  ```bash
  npm run deploy
  ```
- **Untuk seluruh server (Global):**
  ```bash
  npm run deploy:global
  ```

### 6. Jalankan Bot
- Mode pengembangan:
  ```bash
  npm run dev
  ```
- Mode produksi / background (menggunakan PM2):
  ```bash
  npm install -g pm2
  pm2 start src/index.js --name "flavibot-lyric"
  ```

---

## 📜 Lisensi
Proyek ini dibuat untuk keperluan komunitas Discord di bawah lisensi [MIT](LICENSE).
