/*
  # Create music mixes table and storage

  1. New Tables
    - `music_mixes`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `file_path` (text, required) - path to file in storage
      - `file_size` (bigint, required) - file size in bytes
      - `file_type` (text, required) - 'audio' or 'video'
      - `mime_type` (text, required) - actual MIME type
      - `duration` (integer, optional) - duration in seconds
      - `thumbnail_url` (text, optional) - for video thumbnails
      - `user_id` (uuid, required) - references auth.users
      - `is_public` (boolean, default true)
      - `play_count` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Storage
    - Create 'music-mixes' storage bucket
    - Set up RLS policies for secure file access

  3. Security
    - Enable RLS on `music_mixes` table
    - Add policies for CRUD operations based on user ownership and public visibility
    - Set up storage policies for secure file upload/access
*/

-- Create the music_mixes table
CREATE TABLE IF NOT EXISTS music_mixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('audio', 'video')),
  mime_type text NOT NULL,
  duration integer,
  thumbnail_url text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean DEFAULT true,
  play_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE music_mixes ENABLE ROW LEVEL SECURITY;

-- Create policies for music_mixes table
CREATE POLICY "Users can view public mixes and their own mixes"
  ON music_mixes
  FOR SELECT
  TO authenticated
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can insert their own mixes"
  ON music_mixes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own mixes"
  ON music_mixes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own mixes"
  ON music_mixes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create storage bucket for music files
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-mixes', 'music-mixes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'music-mixes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view files they own or public files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'music-mixes' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM music_mixes 
        WHERE file_path = name AND (is_public = true OR user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'music-mixes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'music-mixes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_music_mixes_updated_at
  BEFORE UPDATE ON music_mixes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_music_mixes_user_id ON music_mixes(user_id);
CREATE INDEX IF NOT EXISTS idx_music_mixes_created_at ON music_mixes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_mixes_is_public ON music_mixes(is_public);

-- Function to increment play count
CREATE OR REPLACE FUNCTION increment_play_count(mix_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE music_mixes 
  SET play_count = play_count + 1 
  WHERE id = mix_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE INDEX IF NOT EXISTS idx_music_mixes_file_type ON music_mixes(file_type);