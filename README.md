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
- **Database**: SQLite (MVP) / PostgreSQL (production-ready)
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

3. Set up the database:
```bash
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
DATABASE_URL="file:./dev.db"

# Optional: For DWG processing
FORGE_API_KEY=your_forge_api_key
FORGE_API_SECRET=your_forge_api_secret
DWG_PYTHON_SERVICE_URL=http://localhost:8000
```

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
