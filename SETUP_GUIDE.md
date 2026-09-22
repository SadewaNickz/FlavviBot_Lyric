# 🎵 FlaviBotLyric — Setup Guide

Bot Discord yang otomatis menampilkan synced lyrics (dengan timestamp) untuk lagu yang diputar oleh FlaviBot.

---

## 📋 Langkah 1: Buat Discord Bot

### 1.1 Buat Application di Discord Developer Portal

1. Buka **[Discord Developer Portal](https://discord.com/developers/applications)**
2. Login dengan akun Discord kamu
3. Klik tombol **"New Application"** (pojok kanan atas)
4. Beri nama, misal: `FlaviBotLyric`
5. Klik **Create**

### 1.2 Dapatkan Client ID

1. Di halaman application, klik **"General Information"** di sidebar
2. Salin **Application ID** — ini adalah `CLIENT_ID` kamu

### 1.3 Buat Bot & Dapatkan Token

1. Klik **"Bot"** di sidebar kiri
2. Klik **"Reset Token"** (atau "Add Bot" kalau belum ada)
3. Salin token yang muncul — ini adalah `DISCORD_TOKEN` kamu
4. **PENTING:** Token ini rahasia! Jangan share ke siapapun!

### 1.4 Aktifkan Intents

Masih di halaman **Bot**, scroll ke bawah ke bagian **Privileged Gateway Intents** dan aktifkan:

- ✅ **MESSAGE CONTENT INTENT** — wajib agar bot bisa baca pesan FlaviBot
- ✅ **SERVER MEMBERS INTENT** — opsional
- ✅ **PRESENCE INTENT** — opsional

Klik **Save Changes**.

### 1.5 Invite Bot ke Server

1. Klik **"OAuth2"** di sidebar → **"URL Generator"**
2. Di **Scopes**, centang:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Di **Bot Permissions**, centang:
   - ✅ `Send Messages`
   - ✅ `Send Messages in Threads`
   - ✅ `Embed Links`
   - ✅ `Read Message History`
   - ✅ `View Channels`
4. Salin URL yang dihasilkan dan buka di browser
5. Pilih server Discord kamu dan klik **Authorize**

---

## 📋 Langkah 2: Dapatkan FlaviBot User ID

1. Buka **Discord Settings** → **Advanced** → aktifkan **Developer Mode**
2. Di server kamu, **klik kanan pada FlaviBot** (bot musiknya)
3. Klik **"Copy User ID"**
4. Simpan ID ini — ini adalah `FLAVIBOT_ID` kamu

---

## 📋 Langkah 3: Setup Project

### 3.1 Konfigurasi Environment

1. Salin file `.env.example` dan rename menjadi `.env`:

```bash
copy .env.example .env
```

2. Edit file `.env` dan isi dengan data kamu:

```env
DISCORD_TOKEN=paste_token_bot_kamu_disini
CLIENT_ID=paste_client_id_kamu_disini
FLAVIBOT_ID=paste_flavibot_user_id_disini
```

### 3.2 Install Dependencies

```bash
npm install
```

### 3.3 Register Slash Commands

```bash
npm run deploy
```

> ⚠️ Slash commands global bisa butuh waktu ~1 jam untuk tersedia. Untuk testing lebih cepat, bisa diubah ke guild-specific di `deploy-commands.js`.

### 3.4 Jalankan Bot

```bash
npm start
```

Atau untuk development (auto-restart):
```bash
npm run dev
```

---

## 🎮 Cara Pakai

### Otomatis
Cukup putar lagu di FlaviBot — bot akan otomatis mendeteksi dan menampilkan lirik lengkap dengan timestamp!

### Manual
Ketik slash command di Discord:

```
/lyrics
```
→ Menampilkan lirik dari lagu terakhir yang dideteksi dari FlaviBot

```
/lyrics Bohemian Rhapsody
```
→ Cari lirik berdasarkan judul

```
/lyrics Queen - Bohemian Rhapsody
```
→ Cari lirik berdasarkan artis dan judul (lebih akurat)

---

## 📝 Contoh Output

Lirik ditampilkan dalam format synced (dengan timestamp):

```
🎵 Bohemian Rhapsody
🎤 Artis: Queen  •  💿 Album: A Night at the Opera  •  ⏱ Durasi: 5:55

00:00 ♪ ...
00:49 Is this the real life?
00:52 Is this just fantasy?
00:55 Caught in a landslide
00:58 No escape from reality
01:01 Open your eyes
01:04 Look up to the skies and see
```

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Bot tidak bisa baca pesan FlaviBot | Pastikan **MESSAGE CONTENT INTENT** sudah aktif di Developer Portal |
| Slash command tidak muncul | Jalankan `npm run deploy` dan tunggu ~1 jam |
| Lirik tidak ditemukan | Tidak semua lagu ada di LRCLIB. Coba cari manual dengan judul yang berbeda |
| OCR tidak akurat | Normal — OCR hanya fallback untuk embed berbasis gambar. Gunakan `/lyrics` manual |
| Bot offline | Cek terminal untuk error. Pastikan token di `.env` benar |
