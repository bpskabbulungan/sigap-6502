# Frontend WA Reminder

Antarmuka web untuk platform WA Reminder. Aplikasi ini dibangun dengan React + Vite dan menyediakan dashboard admin, halaman status publik, serta utilitas monitoring bot WhatsApp.

## Ringkasan Fitur

- **Halaman status publik** menampilkan jadwal pengiriman, status bot, statistik aktivitas, serta log terbaru yang dapat diakses tanpa autentikasi.
- **Dashboard admin** untuk mengelola jadwal default, pengumuman terjadwal tambahan, log aktivitas, dan memantau kesehatan bot secara real-time.
- **Editor template pesan** dengan pratinjau langsung agar tim dapat memperbarui konten broadcast tanpa menyentuh backend.
- **Integrasi Socket.IO** untuk streaming status bot, log, dan jadwal terbaru tanpa perlu refresh halaman.
- **Komponen Tailwind** dengan tema gelap (dark mode) yang konsisten dengan branding aplikasi.

## Prasyarat

- Node.js 18 atau lebih baru.
- npm 9+ (terinstal bersama Node.js).
- Backend WA Reminder berjalan atau tersedia melalui jaringan.

> Gunakan `npm install` di direktori root monorepo untuk menginstal dependensi frontend sekaligus backend.

## Cara Menjalankan

### 1. Pengembangan lokal

```bash
# Dari direktori root
npm run dev          # menjalankan backend & frontend bersamaan
# atau jika hanya ingin frontend
npm run dev:frontend # menjalankan Vite dev server di http://localhost:5173
```

Frontend akan secara otomatis memanggil backend di `http://localhost:3301` (lihat variabel lingkungan di bawah) dan menyertakan cookie sesi untuk endpoint admin.

### 2. Build produksi

```bash
# Hanya build frontend dari direktori root
npm run build
# atau dari folder frontend
npm --workspace frontend run build
```

Artefak build berada pada `frontend/dist/` dan dapat disajikan menggunakan web server statis apa pun.

### 3. Preview hasil build

```bash
npm --workspace frontend run preview
```

Perintah ini menjalankan server preview Vite pada port `4173` (default).

## Variabel Lingkungan & Integrasi Backend

Frontend membaca base URL API melalui variabel berikut:

| Variabel                | Default                      | Digunakan di                           |
| ----------------------- | ---------------------------- | -------------------------------------- |
| `VITE_API_BASE_URL`     | `http://localhost:3301`      | Build & runtime Vite (`apiClient.js`)  |
| `BACKEND_HOST` (Docker) | `backend`                    | Entry point Nginx container frontend   |
| `BACKEND_PORT` (Docker) | `3301`                       | Entry point Nginx container frontend   |
| `FRONTEND_BACKEND_HOST` | (opsional, override compose) | `docker-compose.yml` untuk service web |
| `FRONTEND_BACKEND_PORT` | (opsional, override compose) | `docker-compose.yml` untuk service web |

### Menyetel `.env` saat pengembangan

Buat file `frontend/.env` jika ingin mengarahkan frontend ke backend berbeda:

```env
VITE_API_BASE_URL=http://localhost:3301
```

Saat build produksi, variabel dapat diteruskan sebagai build arg Docker atau environment Node.js:

```bash
# Menggunakan environment lokal
VITE_API_BASE_URL=https://api.contoh.id npm --workspace frontend run build

# Atau via Docker build arg
docker build \
  --build-arg VITE_API_BASE_URL=https://api.contoh.id \
  -t wa-reminder-frontend:latest \
  frontend
```

### Integrasi dengan backend

- Pastikan backend mengaktifkan sesi cookie dan CORS sesuai default repo (lihat `backend/.env`).
- Untuk login admin, jalankan backend dan frontend pada domain/host yang sama atau atur cookie cross-site sesuai kebutuhan.
- Endpoint utama yang digunakan frontend mencakup `/api/auth/*`, `/api/admin/schedule*`, `/api/admin/templates*`, `/api/system/*`, dan `/api/schedule*`.
- Jika backend ditempatkan pada domain terpisah, perbarui `VITE_API_BASE_URL` agar mengarah ke host tersebut dan pastikan reverse proxy mengizinkan koneksi WebSocket ke `/socket.io`.

## Panduan Deployment

### Docker (disarankan)

Repo menyediakan `frontend/Dockerfile` yang membangun artefak Vite dan menyajikannya melalui Nginx dengan dukungan `envsubst`.

```bash
# Build image
docker build -t ghcr.io/organisasi/wa-reminder-frontend:latest frontend

# Jalankan container mandiri
docker run -d \
  -e BACKEND_HOST=backend.internal \
  -e BACKEND_PORT=8080 \
  -p 8080:80 \
  ghcr.io/organisasi/wa-reminder-frontend:latest
```

Gunakan variabel `BACKEND_HOST` dan `BACKEND_PORT` untuk mengarahkan Nginx reverse proxy ke backend tanpa rebuild image.

### Docker Compose

Konfigurasi `docker-compose.yml` di root sudah menyiapkan service `frontend` dan `backend` dengan jaringan bersama:

```bash
docker compose up -d frontend backend
```

Override host backend melalui environment host:

```bash
FRONTEND_BACKEND_HOST=backend.local \
FRONTEND_BACKEND_PORT=3301 \
docker compose up -d frontend
```

### Deployment manual via Nginx/Static Hosting

1. Jalankan `npm --workspace frontend run build`.
2. Salin isi `frontend/dist/` ke server web statis (mis. bucket S3 + CloudFront atau Nginx).
3. Konfigurasikan reverse proxy agar meneruskan request API dan WebSocket ke backend:
   - `location /api/` → `http://<host-backend>:3301`
   - `location /socket.io/` → `http://<host-backend>:3301` dengan `proxy_http_version 1.1` dan header upgrade.
4. Setel `VITE_API_BASE_URL` saat build agar mengarah ke URL backend produksi.

Pastikan dokumentasi deployment tetap konsisten dengan panduan utama di `README.md` root.
