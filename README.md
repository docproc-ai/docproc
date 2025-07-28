# AI Document Processor

A human-in-the-loop document extraction web platform that uses AI to extract structured data from documents based on custom JSON schemas, with manual review and approval workflows.

## 🚀 Features

### 📄 Human-in-the-Loop Document Extraction

- **AI-Powered Extraction**: Extract structured data from documents using Anthropic's Claude models
- **Custom JSON Schemas**: Define extraction schemas tailored to your specific document types
- **Human Review & Approval**: Manual verification and correction of AI-extracted data
- **Multi-Format Support**: Process PDFs and images with built-in document viewer
- **Extraction Workflow**: Upload → AI Extract → Human Review → Approve/Reject

### 🔧 Schema Management

- **Visual Schema Builder**: Drag-and-drop interface for creating document schemas
- **Field Types**: Support for strings, numbers, booleans, arrays, and objects
- **Validation**: Built-in validation with Zod schemas
- **Versioning**: Schema snapshots for document consistency

### 📋 Form System

- **Dynamic Form Rendering**: Auto-generated forms based on schemas
- **Data Editor**: Monaco editor for direct JSON manipulation
- **Validation**: Real-time form validation and error handling
- **Responsive Design**: Mobile-friendly interface

### 🔐 Authentication & Security

- **Better-auth Integration**: Secure authentication with session management
- **Role-based Access**: Admin and user roles with appropriate permissions
- **Protected Routes**: Middleware-based route protection
- **Default Admin**: Automatic admin user creation on first run

### 📊 Document Management

- **Queue System**: Organized document processing queue
- **Status Tracking**: Pending, processed, approved, and rejected states
- **Approval Workflow**: Manual review and approval process
- **File Storage**: Secure document storage with organized file system

### 🎨 Modern UI/UX

- **Shadcn/ui Components**: Beautiful, accessible UI components
- **Dark/Light Theme**: Theme switching with next-themes
- **Responsive Layout**: Resizable panels and mobile-optimized design
- **Real-time Updates**: Live status updates and notifications

## 🛠️ Tech Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - Modern UI component library
- **React Hook Form** - Form handling with validation
- **Monaco Editor** - Code editor for JSON editing

### Backend

- **Next.js API Routes** - Server-side API endpoints
- **Drizzle ORM** - Type-safe database operations
- **PostgreSQL** - Primary database
- **Better-auth** - Authentication and session management
- **Anthropic AI SDK** - AI document processing

### Infrastructure

- **Docker** - Containerized deployment
- **Docker Compose** - Multi-service orchestration
- **File System Storage** - Document storage management

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- Docker and Docker Compose (for containerized setup)
- PostgreSQL (if running locally)

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/bherbruck/ai-document-processor.git
   cd ai-document-processor
   ```

2. **Create environment file**

   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables**

   ```bash
   # Authentication
   DEFAULT_ADMIN_EMAIL="admin@example.com"
   DEFAULT_ADMIN_PASSWORD="admin123"
   BETTER_AUTH_SECRET="your-secret-key"

   # Database
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

   # AI Processing
   ANTHROPIC_API_KEY="your-anthropic-api-key"

   # Storage
   DOCUMENT_STORAGE_DIR="./data/documents"
   ```

### Development Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start PostgreSQL** (if running locally)

   ```bash
   # Using Docker
   docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres

   # Or use your preferred PostgreSQL setup
   ```

3. **Push database schema**

   ```bash
   npm run db:push
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with your configured admin credentials

### Docker Deployment

1. **Using Docker Compose** (Recommended)

   ```bash
   docker compose up
   ```

2. **Manual Docker Build**
   ```bash
   docker build -t ai-document-processor .
   docker run -p 3000:3000 ai-document-processor
   ```

## 📖 Usage Guide

### 1. Define Document Types & Schemas

- Navigate to **Document Types** to create extraction schemas for your document types
- Use the **Schema Builder** to define what data fields should be extracted
- Configure field types, validation rules, and structure for your specific use case
- Set up webhooks for external integrations (optional)

### 2. Human-in-the-Loop Extraction Workflow

- **Upload**: Select a document type and upload documents via drag-and-drop
- **AI Extract**: Use the **Process** button to let AI extract data based on your schema
- **Human Review**: Review AI-extracted data in the form interface or JSON editor
- **Correct & Validate**: Edit any incorrect or missing data extracted by AI
- **Approve**: Finalize the extraction by approving the reviewed data
- **Export**: Use approved data for downstream processes via API or webhooks

### 3. Schema Building

- **String Fields**: Text inputs with optional patterns and validation
- **Number Fields**: Numeric inputs with min/max constraints
- **Boolean Fields**: Checkbox inputs
- **Array Fields**: Dynamic lists of items
- **Object Fields**: Nested object structures

### 4. User Management

- Access **Users** page (admin only) to manage user accounts
- Create additional users with appropriate roles
- Monitor user activity and permissions

## 🔧 API Reference

### Document Types

- `GET /api/document-types` - List all document types
- `POST /api/document-types` - Create new document type
- `PUT /api/document-types/[id]` - Update document type
- `DELETE /api/document-types/[id]` - Delete document type
- `POST /api/document-types/[id]/upload` - Upload documents for processing

### Documents

- `GET /api/documents` - List documents
- `POST /api/documents` - Create new document
- `PUT /api/documents/[id]` - Update document
- `DELETE /api/documents/[id]` - Delete document
- `GET /api/documents/[id]/file` - Download document file

## 🔒 Security

- **Authentication**: Secure session-based authentication
- **Authorization**: Role-based access control
- **File Upload**: Validated file types and secure storage
- **API Protection**: Middleware-based route protection
- **Data Validation**: Zod schema validation throughout

## 🚀 Deployment

### Production Environment Variables

```bash
# Required
DATABASE_URL="your-production-database-url"
ANTHROPIC_API_KEY="your-anthropic-api-key"
BETTER_AUTH_SECRET="your-production-secret"

# Optional
DEFAULT_ADMIN_EMAIL="admin@yourdomain.com"
DEFAULT_ADMIN_PASSWORD="secure-password"
DOCUMENT_STORAGE_DIR="/app/documents"
```

### Docker Production

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Or with custom environment
docker-compose --env-file .env.production up -d
```

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run db:push` - Push database schema
- `npm run db:studio` - Open Drizzle Studio

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── document-types/    # Document type management
│   ├── process/           # Document processing
│   └── users/             # User management
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── form-renderer/    # Dynamic form components
│   └── schema-builder/   # Schema building components
├── db/                   # Database configuration
├── hooks/                # Custom React hooks
└── lib/                  # Utility functions and actions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/bherbruck/ai-document-processor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bherbruck/ai-document-processor/discussions)
- **Documentation**: Check the `memory-bank/` directory for additional documentation

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Anthropic](https://www.anthropic.com/) - AI processing capabilities
- [Shadcn/ui](https://ui.shadcn.com/) - UI component library
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- [Better-auth](https://www.better-auth.com/) - Authentication solution
