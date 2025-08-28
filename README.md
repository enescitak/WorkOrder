# İş Emri Zaman Çizelgesi Uygulaması

Bu uygulama fabrika iş emirlerini Gantt-chart tarzı zaman çizelgesinde görselleştiren bir web uygulamasıdır. Operasyonları sürükle-bırak ile farklı makinelere ve zaman dilimlerine taşıyabilirsiniz.

## Özellikler

- ✅ İş emirlerini Gantt-chart formatında görselleştirme
- ✅ Makinelere göre operasyon dağılımı
- ✅ Drag & Drop ile operasyon düzenleme
- ✅ Gerçek zamanlı güncelleme
- ✅ Responsive tasarım
- ✅ Modern ve kullanıcı dostu arayüz

## Teknolojiler

**Backend:**
- Python 3.9+
- FastAPI
- PostgreSQL
- SQLAlchemy ORM

**Legacy Backend (Node.js):**
- Node.js
- Express.js
- CORS

**Frontend:**
- React 19 (TypeScript)
- @dnd-kit (Drag & Drop)
- date-fns (Tarih işlemleri)
- Axios (API istekleri)

## Kurulum ve Çalıştırma

### 1. Tüm bağımlılıkları yükle
```bash
npm run install-all
```

### 2. Uygulamayı çalıştır (hem backend hem frontend)
```bash
npm run dev
```

### Alternatif: Ayrı ayrı çalıştırma

**Backend:**
```bash
npm run server
```

**Frontend:**
```bash
npm run client
```

## Erişim

- **Frontend:** http://localhost:3001
- **Backend API (Python/FastAPI):** http://localhost:5002
- **Legacy Backend API (Node.js):** http://localhost:5001

## API Endpoints

Temel adres: `http://localhost:5002`

### İş Emirleri
- `GET /api/workorders` — Tüm iş emirlerini getirir
  - 200 OK → `WorkOrder[]`
- `GET /api/workorders/:id` — Belirli bir iş emrini getirir
  - 200 OK → `WorkOrder`
  - 404 Not Found → `{ "detail": "Work order not found" }`

### Operasyonlar
- `PUT /api/operations/:id` — Bir operasyonu günceller (drag & drop veya form ile)
  - İstek gövdesi (en az bir alan zorunlu):
    - `machine_id?: string`
    - `start?: string` (ISO-8601 UTC, örn: `2025-08-20T10:10:00Z`)
    - `end?: string` (ISO-8601 UTC)
  - Kurallar (sunucu doğrular ve gerekirse 400 döner):
    - R1 — Precedence: `index k` başlangıcı, `index k-1` bitişinden önce olamaz
    - R2 — Lane exclusivity: aynı `machine_id` üstünde çakışma olamaz
    - R3 — No past: `start` şimdiden önce olamaz
  - Yanıtlar:
    - 200 OK → `{ message: string, operation: Operation }`
    - 400 Bad Request → `{ detail: string }` (kural hatası mesajı)
    - 404 Not Found → `{ detail: "Operation not found" }`

### Makineler
- `GET /api/machines` — Tüm benzersiz `machine_id` listesini getirir
  - 200 OK → `string[]` (ör: `["M1","M2"]`)

## Veri Yapısı

### WorkOrder
```typescript
{
  id: string;          // "WO-1001"
  product: string;     // "Widget A"
  qty: number;         // 100
  operations: Operation[];
}
```

### Operation
```typescript
{
  id: string;          // "OP-1"
  workOrderId: string; // "WO-1001"
  index: number;       // 1 (iş emri içi sıralama)
  machineId: string;   // "M1"
  name: string;        // "Kesim"
  start: string;       // ISO-8601 UTC, örn: "2025-08-20T09:00:00Z"
  end: string;         // ISO-8601 UTC, örn: "2025-08-20T10:00:00Z"
}
```

## API Örnekleri

### Tüm iş emirlerini getir
```bash
curl -s http://localhost:5002/api/workorders | jq '.[0]'
```

### Tek iş emrini getir
```bash
curl -s http://localhost:5002/api/workorders/WO-1001 | jq '{id, product, ops: (.operations|length)}'
```

### Makineleri getir
```bash
curl -s http://localhost:5002/api/machines
```

### Operasyon güncelle (başarılı örnek)
```bash
curl -s -X PUT http://localhost:5002/api/operations/OP-2 \
  -H 'Content-Type: application/json' \
  -d '{
        "machine_id": "M2",
        "start": "2025-08-20T10:10:00Z",
        "end":   "2025-08-20T12:00:00Z"
      }'
```

### Operasyon güncelle (hata örneği — R1 ihlali)
```bash
curl -s -X PUT http://localhost:5002/api/operations/OP-2 \
  -H 'Content-Type: application/json' \
  -d '{
        "start": "2025-08-20T09:30:00Z"
      }'
# { "detail": "Operation OP-2 (index 2) cannot start before operation OP-1 (index 1) ends at 2025-08-20T10:00:00Z" }
```

### Operasyon güncelle (hata örneği — R2 ihlali)
```bash
curl -s -X PUT http://localhost:5002/api/operations/OP-3 \
  -H 'Content-Type: application/json' \
  -d '{
        "machine_id": "M1",
        "start": "2025-08-20T09:30:00Z",
        "end":   "2025-08-20T10:15:00Z"
      }'
# { "detail": "Operation OP-3 overlaps with operation ... on machine M1 ..." }
```

### Operasyon güncelle (hata örneği — R3 ihlali)
```bash
curl -s -X PUT http://localhost:5002/api/operations/OP-1 \
  -H 'Content-Type: application/json' \
  -d '{
        "start": "2000-01-01T10:00:00Z"
      }'
# { "detail": "Operation cannot start in the past. Current time: ..." }
```

## Seed ve Veri Tabanı

- PostgreSQL tablolarını oluşturup veriyi yüklemek için:
```bash
cd backend_python
./venv/bin/python seed_data.py
```
- (Opsiyonel) Var olan operasyonları bugüne ötelemek için:
```bash
./venv/bin/python shift_to_today.py
```

## Kullanım

1. Uygulama açıldığında mevcut iş emirleri ve operasyonları görürsünüz
2. Her operasyon farklı renkte ve makine satırında gösterilir
3. Operasyonları sürükleyip farklı makine satırlarına veya zaman dilimlerine bırakabilirsiniz
4. Değişiklikler otomatik olarak kaydedilir
5. Alt kısımdaki renk kodlu lejanttan hangi iş emrinin hangi renkte olduğunu görebilirsiniz

## Geliştirme

Bu proje Create React App ile TypeScript template kullanılarak oluşturulmuştur. Geliştirme sırasında:

- Backend: `nodemon` ile otomatik yeniden başlatma
- Frontend: React development server ile hot reload
- TypeScript tip güvenliği
- Modern ES6+ özellikler

## Lisans

MIT
