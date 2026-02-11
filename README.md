# Facade BOM Extractor

A SAAS tool that helps facade contractors automatically extract material information from architectural drawings (.dwg and .pdf formats) to generate BOM/BOQ data.

## Features

- Upload PDF and DWG architectural drawings
- Automatic extraction of:
  - Material types (glass, aluminum, steel, composite, etc.)
  - Dimensions and measurements
  - Quantities and counts
  - Annotations and notes
- Project management
- Material grouping and BOM/BOQ generation
- Sortable and filterable material tables

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Vercel Postgres or any Postgres)
- **File storage**: Vercel Blob (on Vercel) or local `uploads/` (local dev)
- **ORM**: Prisma
- **PDF Processing**: pdf-parse
- **DWG Processing**: LibreDWG (free, built-in) or Autodesk Forge API / Python ezdxf service

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up the database (PostgreSQL required; use a local Postgres or a hosted URL in `.env`):
```bash
# Set DATABASE_URL in .env, then:
npx prisma migrate dev
```

4. (Optional) For alternative DWG processing:
   - Autodesk Forge API: Set `FORGE_API_KEY` and `FORGE_API_SECRET` in `.env`
   - Python service: Set `DWG_PYTHON_SERVICE_URL` in `.env`
   - Note: DWG extraction works by default using LibreDWG - no config needed

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
facade-bom-extractor/
├── app/
│   ├── api/              # API routes
│   ├── projects/         # Project pages
│   └── page.tsx          # Home page
├── components/           # React components
├── lib/                 # Utility functions
│   ├── db.ts            # Database connection
│   ├── pdf-extractor.ts  # PDF processing
│   ├── dwg-processor.ts # DWG processing
│   └── material-parser.ts # Material extraction
├── types/               # TypeScript types
└── prisma/              # Database schema
```

## DWG Processing

The application supports multiple methods for processing DWG files:

1. **LibreDWG** (Default - Free & Built-in)
   - Uses [@mlightcad/libredwg-web](https://www.npmjs.com/package/@mlightcad/libredwg-web) - GPL-2.0
   - Parses DWG files directly in Node.js via WebAssembly
   - Extracts text from TEXT, MTEXT, dimensions, attributes, and table cells
   - No configuration required - works out of the box

2. **Autodesk Forge API** (Optional - Most Accurate)
   - Requires API key and secret
   - Set `FORGE_API_KEY` and `FORGE_API_SECRET` in `.env`

3. **Python Service** (Optional)
   - Uses ezdxf library
   - Deploy as separate service
   - Set `DWG_PYTHON_SERVICE_URL` in `.env`

4. **Basic Method** (Fallback)
   - Last resort for binary extraction
   - Rarely works for real DWG files

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required: PostgreSQL connection string (local or Vercel Postgres)
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Optional: Vercel Blob (on Vercel this is set automatically when you add Blob storage)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Optional: For DWG processing
FORGE_API_KEY=your_forge_api_key
FORGE_API_SECRET=your_forge_api_secret
DWG_PYTHON_SERVICE_URL=http://localhost:8000
```

## Deploying to Vercel

### 1. Database (Vercel Postgres)

1. In the [Vercel Dashboard](https://vercel.com/dashboard), open your project → **Storage**.
2. Click **Create Database** → choose **Postgres** (Vercel Postgres).
3. Create the database and **connect it to your project**. Vercel will add `POSTGRES_URL` (and often `DATABASE_URL`) to your project environment.
4. If Prisma expects `DATABASE_URL`, set it in **Project → Settings → Environment Variables**: either copy the value from `POSTGRES_URL` or add a variable `DATABASE_URL` with the same connection string (e.g. `postgres://...`).

**Migrations on Vercel:** You do **not** run `npx prisma migrate dev` on Vercel. That command is for local development. On Vercel, migrations run automatically during **build**: the `build` script runs `prisma migrate deploy`, which applies any pending migrations to the production database. So:

- **Locally:** Run `npx prisma migrate dev` to create and apply migrations.
- **On Vercel:** Push your code; the build runs `prisma generate && prisma migrate deploy && next build`, so the production DB is migrated before the app is built.

### 2. Blob storage (Vercel Blob)

1. In the same project, go to **Storage** → **Create Database** → **Blob**.
2. Create the Blob store and connect it to your project. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.
3. No code changes needed: the app uses Blob when `BLOB_READ_WRITE_TOKEN` is set (uploads go to Blob and `filePath` in the DB stores the blob URL).

**Note:** Server-side uploads to Vercel Blob are limited to **4.5 MB** per file. Larger files would require client-side uploads (e.g. Vercel’s client upload API).

### 3. Deploy

Push to your connected Git branch. Vercel will:

1. Install dependencies (`npm install` → runs `postinstall` → `prisma generate`).
2. Run `prisma migrate deploy` (as part of `build`) to apply migrations.
3. Run `next build` and deploy.

## Usage

1. **Upload a Drawing**: Drag and drop or select a PDF or DWG file
2. **Automatic Processing**: The system extracts material information
3. **View Results**: Browse extracted materials grouped by type
4. **Generate BOM/BOQ**: View combined material lists across all drawings in a project

## API Endpoints

- `POST /api/upload` - Upload a drawing file
- `POST /api/extract` - Process and extract materials from a drawing
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create a new project
- `GET /api/export?projectId=...` or `?drawingId=...` - Export materials as CSV (DataFrame-style)

## Data Principles (DDC-Inspired)

The extractor applies principles from [Data-Driven Construction](https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto):

- **Structured output**: Elements as rows, properties as columns (materialType, dimensions, quantity, etc.)
- **Source traceability**: Every material links to its origin (file, entity type, layer, page)
- **Confidence tagging**: Classified as confirmed, estimated, or missing
- **Data quality metrics**: Fill rates for type, dimensions, quantity
- **Open formats**: CSV export for integration with Excel, BI, or downstream ETL
- **QTO aggregation**: Quantity take-off by material type with rollup totals
- **No vendor lock-in**: LibreDWG + pdf-parse run fully offline

## Future Enhancements

- User authentication and multi-tenancy
- Cloud storage integration (S3, Azure Blob)
- Advanced ML-based material recognition
- Export to Excel (CSV export available)
- Project templates and saved configurations
- API for integrations
- Real-time collaboration

## License

MIT
