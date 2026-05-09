# 🧮 Hitung Cepat! (Pintar Berhitung)

Aplikasi edukasi interaktif dan menyenangkan untuk belajar matematika dasar dan pengenalan bangun ruang 3D. Didesain dengan gaya brutalist yang ceria untuk menarik perhatian anak-anak dan pelajar.

## ✨ Fitur Utama

*   **🎮 Game Berhitung Cepat:** Berlatih operasi matematika dasar (Penjumlahan, Pengurangan, dan Perkalian) dengan 3 tingkat kesulitan: Mudah, Sedang, dan Sulit.
*   **🧊 Pengenalan Bangun Ruang 3D:** Modul pembelajaran interaktif untuk bereksplorasi dengan bangun ruang 3D (Kubus, Balok, Tabung, Bola, Kerucut). Objek dapat diputar (interaktif) dan dilengkapi dengan informasi detail mengenai jumlah sisi, rusuk, dan titik sudut.
*   **🏆 Papan Peringkat Global (Leaderboard real-time):** Bersaing dengan pemain lain! Masukkan nama sebelum bermain dan skor akhir akan disimpan ke database secara *real-time* dan ditampilkan kepada semua pemain.
*   **🔊 Efek Suara & Animasi Ceria:** Umpan balik audiovisual lengkap. Animasi UI dibangun dengan Framer Motion, ditambah dengan *background music* (BGM) dan efek suara untuk jawaban benar/salah.
*   **⭐ Visualisasi Belajar:** Saat bermain, soal penjumlahan dan pengurangan menampilkan ilustrasi bintang visual untuk membantu pemahaman konsep berhitung dasar dengan lebih nyata.

## 🚀 Teknologi yang Digunakan

*   **Framework Frontend:** React 18, TypeScript, Vite
*   **Styling:** Tailwind CSS (Menggunakan skema desain *Playful Brutalism*)
*   **Rendering 3D:** `@react-three/fiber`, `@react-three/drei`, `three.js`
*   **Animasi:** `framer-motion`, `canvas-confetti` untuk selebrasi kemenangan
*   **Backend / Database:** Express.js dan SQLite (better-sqlite3) via REST API
*   **Ikon:** `lucide-react`

## 🛠️ Cara Menjalankan Aplikasi Lokal

1. Pastikan Anda telah menginstal `Node.js` dan `npm`.
2. Buka terminal pada folder proyek ini.
3. Install seluruh dependensi:
   ```bash
   npm install
   ```
4. Jalankan *development server*:
   ```bash
   npm run dev
   ```
5. Buka tautan lokal (biasanya `http://localhost:3000`) di browser web Anda.

## 🗄️ Penyimpanan Data Lengkap

Aplikasi ini menggunakan SQLite (`better-sqlite3`) yang tidak membutuhkan instalasi server database tersendiri.
Seluruh data (seperti skor pada Papan Peringkat) akan disimpan di file `data/database.sqlite` di root repositori ketika dijalankan lokal. 
Anda hanya perlu melakukan `git clone` repositori dan *install* depedensinya, aplikasi sudah lengkap dengan backend dan frontend.

---
*Dibuat dan dipelihara menggunakan AI Studio Coding Agent.*
