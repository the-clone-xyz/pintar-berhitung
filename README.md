# Hitung Cepat! (Pintar Berhitung)

Aplikasi edukasi interaktif untuk pembelajaran matematika dasar dan pengenalan bangun ruang 3D. Didesain dengan gaya antarmuka *brutalist* untuk memberikan pengalaman belajar yang dinamis dan menarik.

## Fitur Utama

*   **Game Berhitung Cepat:** Modul latihan operasi matematika dasar (Penjumlahan, Pengurangan, dan Perkalian) yang dilengkapi dengan 3 tingkat kesulitan: Mudah, Sedang, dan Sulit.
*   **Pengenalan Bangun Ruang 3D:** Modul pembelajaran interaktif untuk bereksplorasi dengan berbagai bangun ruang tiga dimensi (Kubus, Balok, Tabung, Bola, Kerucut). Antarmuka 3D interaktif yang memungkinkan pengguna untuk memutar objek dan melihat informasi referensi mendetail mengenai jumlah sisi, rusuk, dan titik sudut.
*   **Papan Peringkat (Leaderboard):** Sistem pencatatan skor kompetitif. Skor akhir pengguna akan disimpan ke basis data secara *real-time* dan ditampilkan pada papan peringkat terbuka.
*   **Audio & Animasi Taktil:** Umpan balik audiovisual untuk meningkatkan imersi dan motivasi pengguna.
*   **Visualisasi Komputasi:** Selama modul latihan berjalan, layar menampilkan ilustrasi visual untuk mempermudah perhitungan dasar bagi pengguna.

## Spesifikasi Teknologi

*   **Lingkungan Eksekusi Frontend:** React 18, TypeScript, Vite
*   **Styling:** Tailwind CSS 
*   **Rendering 3D:** `@react-three/fiber`, `@react-three/drei`, `three.js`
*   **Animasi & Interaksi:** `framer-motion`, `canvas-confetti`
*   **Sistem Backend:** Express.js via Node.js
*   **Database:** SQLite (`better-sqlite3`) terintegrasi langsung dalam proyek.

## Panduan Instalasi Lokal

Proyek ini telah dikonfigurasi sebagai aplikasi *full-stack* dan memiliki pengaturan basis data yang terpusat, sehingga mempermudah proses kloning (clone) dan eksekusi lokal tanpa perlu konfigurasi infrastruktur eksternal.

1. Pastikan lingkungan kerja Anda telah memiliki `Node.js` dan `npm`.
2. Lakukan *clone* repositori ke mesin lokal Anda, kemudian navigasi ke direktori root proyek.
3. Lakukan instalasi semua dependensi:
   ```bash
   npm install
   ```
4. Mulai server pengembangan:
   ```bash
   npm run dev
   ```
5. Buka tautan lokal (default: `http://localhost:3000`) pada peramban (browser) web pilihan Anda.

## Manajemen Data (SQLite)

Penyimpanan instan dan internal pada aplikasi menggunakan `better-sqlite3`. Backend akan secara otomatis membuat direktori `data` beserta basis datanya `database.sqlite` ketika server mulai dijalankan jika file tersebut belum tersedia. Pendekatan ini mendukung portabilitas kode dan kemudahan pengembangan, mengurangi ketergantungan pada layanan cloud *third-party* saat menjalankan aplikasi secara komprehensif (frontend-to-backend).

---
*Dibuat menggunakan konfigurasi modular dan siap dikembangkan lebih lanjut.*