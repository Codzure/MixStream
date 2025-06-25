# MixStream App

## Overview
MixStream is a modern web application designed for uploading, managing, and streaming music mixes, prioritizing performance and user experience.

## Technical Stack

- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS with custom CSS modules
- **State Management**: React Context API
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **File Storage**: Supabase Storage
- **UI Components**: Custom components with Framer Motion for animations
- **Icons**: Lucide React

## Key Features

### 1. User Authentication

- Email/password authentication via Supabase
- Protected routes
- User-specific content filtering

### 2. Media Management

- Upload audio and video files
- Chunked file uploads with progress tracking
- Support for resumable uploads
- File validation and error handling

### 3. Media Playback

- Custom media player with playback controls
- Progress bar with seek functionality
- Volume control and mute toggle
- Fullscreen mode for video content
- Audio visualization on play

### 4. User Interface

- Responsive grid/list view
- Animated transitions with Framer Motion
- Loading states and error handling
- Toast notifications for user feedback

### 5. Search & Filtering

- Full-text search by title
- Filter by media type (audio/video)
- Sort by recent, popular, or trending

## Database Schema

### `music_mixes` Table

- `id` (uuid): Primary key
- `title` (text): Mix title
- `description` (text, optional): Mix description
- `file_path` (text): Path to file in storage
- `file_size` (bigint): File size in bytes
- `file_type` (text): 'audio' or 'video'
- `mime_type` (text): Actual MIME type
- `duration` (integer, optional): Duration in seconds
- `thumbnail_url` (text, optional): For video thumbnails
- `user_id` (uuid): Reference to auth.users
- `is_public` (boolean): Visibility setting
- `play_count` (integer): Track plays
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Storage

- Uses Supabase Storage bucket named 'music-mixes'
- Files stored with user-specific paths
- Supports chunked uploads for large files
- Implements RLS (Row Level Security) for access control

## Performance Optimizations

- Chunked file uploads with parallel processing
- Client-side hashing for file integrity
- Caching and memoization
- Lazy loading of components
- Optimized database queries with proper indexing

## Security

- Row-level security policies
- Signed URLs for file access
- Input validation
- Secure file type checking
- Authentication checks on all routes

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run development server: `npm run dev`

## Deployment

- Can be deployed to Vercel, Netlify, or similar platforms
- Requires Supabase project configuration
- Environment variables must be set in deployment environment

## Future Enhancements

- Implement user profiles
- Add social features (likes, comments, sharing)
- Create playlists
- Add offline support with service workers
- Implement audio waveform visualization
- Add support for more media formats
- Implement server-side rendering for better SEO

## Known Issues

- Large file uploads may be slow on certain connections
- Some edge cases in error handling
- Mobile UI could be improved

## Dependencies

- React 18+
- TypeScript
- Supabase JS Client
- Framer Motion
- Lucide React
- React Hot Toast
- date-fns
- p-map (for parallel uploads)
