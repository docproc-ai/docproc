# Claude AI Development Rules

## Development Server Rules
- NEVER run `npm run dev` - the user always has it running already
- NEVER run `npm run build` - the user manages their own build process  
- NEVER start, stop, or restart development servers
- Assume the development server and database are always running and available, ask the user to start them if needed

## Build Process Rules  
- Do not run build commands unless explicitly requested by the user
- Focus on code implementation and testing rather than build management
- Trust that the user has proper development environment setup

## Testing Rules
- User manages their own development environment
- Assume localhost servers are already running when needed
- Only run commands that are specifically requested or essential for the task