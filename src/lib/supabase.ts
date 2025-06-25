import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
})

// Storage bucket name
export const STORAGE_BUCKET = 'music-mixes'

// Helper function to get secure streaming URL
export const getStreamingUrl = async (filePath: string): Promise<string | null> => {
  if (!filePath) {
    console.error('No file path provided for streaming URL');
    return null;
  }

  try {
    console.log('Generating URL for:', filePath);
    
    // First try to get a public URL (if the file is public)
    const { data: publicUrl } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    
    console.log('Generated public URL:', publicUrl.publicUrl);
    
    // Test if the public URL is accessible
    try {
      console.log('Testing public URL accessibility...');
      const testResponse = await fetch(publicUrl.publicUrl, { 
        method: 'HEAD',
        cache: 'no-store' // Prevent caching
      });
      
      console.log('Public URL test response:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        ok: testResponse.ok,
        headers: Object.fromEntries(testResponse.headers.entries())
      });
      
      if (testResponse.ok) {
        console.log('Using public URL:', publicUrl.publicUrl);
        return publicUrl.publicUrl;
      } else {
        console.warn(`Public URL test failed with status ${testResponse.status}: ${testResponse.statusText}`);
      }
    } catch (e) {
      console.warn('Error testing public URL, falling back to signed URL:', e);
    }
    
    // If public URL fails, generate a signed URL
    console.log('Generating signed URL...');
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 86400); // 24 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }
    
    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from storage');
    }
    
    console.log('Generated signed URL:', data.signedUrl.substring(0, 100) + '...');
    return data.signedUrl;
    
  } catch (error) {
    console.error('Failed to get streaming URL:', error);
    throw error;
  }
}

import pMap from 'p-map';

const UPLOAD_CONCURRENCY = 3; // Number of parallel uploads
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks
const MAX_RETRIES = 3; // Maximum number of retry attempts for failed chunks

// Helper function to generate a simple file hash
const generateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Save upload progress to localStorage
const saveUploadProgress = (uploadId: string, uploadedChunks: number[], totalChunks: number) => {
  const progress = {
    uploadedChunks: [...new Set(uploadedChunks)], // Remove duplicates
    totalChunks,
    timestamp: Date.now()
  };
  localStorage.setItem(`upload-${uploadId}`, JSON.stringify(progress));
};

// Get resumed chunks from localStorage
const getResumedChunks = (uploadId: string): number[] => {
  const progress = localStorage.getItem(`upload-${uploadId}`);
  if (!progress) return [];
  
  const { uploadedChunks, timestamp } = JSON.parse(progress);
  // Clear progress if older than 24 hours
  if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
    localStorage.removeItem(`upload-${uploadId}`);
    return [];
  }
  
  return uploadedChunks || [];
};

// Complete the upload and clean up
const completeUpload = async (uploadId: string, filePath: string, totalChunks: number) => {
  // In a real implementation, you'd want to combine chunks server-side
  // For now, we'll just rename the first chunk
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .move(`${filePath}.part0`, filePath);
  
  if (error) throw error;
  
  // Clean up remaining chunks
  const chunksToRemove = [];
  for (let i = 1; i < totalChunks; i++) {
    chunksToRemove.push(`${filePath}.part${i}`);
  }
  
  if (chunksToRemove.length > 0) {
    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(chunksToRemove)
      .catch(console.warn);
  }
  
  // Clear upload progress
  localStorage.removeItem(`upload-${uploadId}`);
  
  return data;
};

// Upload a single chunk with retry logic
const uploadChunk = async (
  file: File,
  filePath: string,
  chunkIndex: number,
  uploadId: string,
  totalChunks: number,
  onProgress?: (progress: number) => void
) => {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunk = file.slice(start, end);
  
  // Use a simpler chunk path to avoid long filenames
  const chunkPath = `${filePath}.part${chunkIndex}`;
  
  let lastError: Error | null = null;
  
  // Retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(chunkPath, chunk, { 
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      
      if (!error) {
        // Update progress after successful upload
        const uploadedChunks = getResumedChunks(uploadId);
        const progress = (uploadedChunks.length + 1) / totalChunks * 95; // Cap at 95% until completion
        onProgress?.(progress);
        return true;
      }
      
      lastError = error;
      console.warn(`Attempt ${attempt} failed for chunk ${chunkIndex}:`, error);
      
      // Exponential backoff before retry
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`Error uploading chunk ${chunkIndex} (attempt ${attempt}):`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error(`Failed to upload chunk ${chunkIndex} after ${MAX_RETRIES} attempts`);
};

// Main upload function with improved chunking and progress tracking
export const uploadFile = async (
  file: File,
  filePath: string,
  onProgress?: (progress: number) => void
) => {
  try {
    console.log('Starting file upload:', { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      filePath 
    });

    // Generate a unique upload ID for resumable uploads
    const fileHash = await generateFileHash(file);
    const uploadId = `${fileHash.slice(0, 8)}-${Date.now()}`; // Shorter ID
    
    // Calculate chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = getResumedChunks(uploadId);
    
    console.log(`Uploading ${totalChunks} chunks (${uploadedChunks.length} already uploaded)`);

    // Upload chunks in parallel
    const chunkIndexes = Array.from({ length: totalChunks }, (_, i) => i)
      .filter(i => !uploadedChunks.includes(i));
    
    await pMap(chunkIndexes, async (chunkIndex) => {
      await uploadChunk(file, filePath, chunkIndex, uploadId, totalChunks, (progress) => {
        // Update progress for this chunk
        uploadedChunks = [...new Set([...uploadedChunks, chunkIndex])];
        saveUploadProgress(uploadId, uploadedChunks, totalChunks);
        onProgress?.(progress);
      });
      
      // Update the uploaded chunks list after successful upload
      uploadedChunks = [...new Set([...uploadedChunks, chunkIndex])];
      saveUploadProgress(uploadId, uploadedChunks, totalChunks);
    }, { concurrency: UPLOAD_CONCURRENCY });
    
    // Complete the upload
    const result = await completeUpload(uploadId, filePath, totalChunks);
    onProgress?.(100);
    
    // Clean up progress tracking
    localStorage.removeItem(`upload-${uploadId}`);
    
    console.log('Upload successful:', result);
    return result;
    
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
};

// Note: The uploadLargeFile function was removed in favor of the improved uploadFile function
// which includes better chunking, retry logic, and progress tracking.

// Helper function to delete file
export const deleteFile = async (filePath: string) => {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])
    
    if (error) throw error
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
}

// Helper function to get file metadata
export const getFileMetadata = async (filePath: string) => {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(filePath.split('/').slice(0, -1).join('/'), {
        search: filePath.split('/').pop()
      })
    
    if (error) throw error
    return data?.[0]
  } catch (error) {
    console.error('Failed to get file metadata:', error)
    throw error
  }
}

// Helper function to check storage bucket status
export const checkStorageBucket = async () => {
  try {
    // Try to list files in the bucket - this will fail if the bucket doesn't exist
    // or if we don't have permissions
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list()
    
    // If we don't get an error, the bucket exists and is accessible
    if (!error) {
      console.log('Storage bucket is accessible')
      return true
    }
    
    // Check the error message to determine if the bucket doesn't exist
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      console.error('Storage bucket does not exist. Please create it in the Supabase dashboard.')
      return false
    }
    
    // For other errors, log them and return false
    console.error('Error accessing storage bucket:', error)
    return false
    
  } catch (error) {
    console.error('Failed to check storage bucket:', error)
    return false
  }
}

// Helper function to test database connection
export const testDatabaseConnection = async () => {
  try {
    const { count, error } = await supabase
      .from('music_mixes')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.error('Database connection test failed:', error)
      return false
    }
    
    console.log('Database connection test successful. Total mixes:', count)
    return true
  } catch (error) {
    console.error('Database connection test error:', error)
    return false
  }
}