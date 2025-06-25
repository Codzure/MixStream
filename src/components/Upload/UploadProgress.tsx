import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  fileName: string;
  fileSize: number;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const UploadProgress = ({
  progress,
  status,
  fileName,
  fileSize,
  onRetry,
  onCancel,
}: UploadProgressProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full bg-gray-800/50 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              {status === 'uploading' && (
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
              {status === 'error' && (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
            </div>
            
            {/* Progress ring */}
            {status === 'uploading' && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent"
                style={{
                  rotate: 360,
                  transition: 'rotate 1s linear infinite',
                }}
              />
            )}
          </div>
          
          <div>
            <p className="font-medium text-white truncate max-w-xs">{fileName}</p>
            <p className="text-sm text-gray-400">{formatFileSize(fileSize)}</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            {Math.round(progress)}%
          </p>
          <p className="text-xs text-gray-400">
            {status === 'uploading' ? 'Uploading...' : 
             status === 'success' ? 'Completed' : 'Failed'}
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      
      {/* Speed and time remaining */}
      {status === 'uploading' && (
        <div className="flex justify-between text-xs text-gray-400">
          <span>Speed: Calculating...</span>
          <span>Time remaining: Calculating...</span>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="flex justify-end space-x-2 pt-2">
        {status === 'error' && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        )}
        {status === 'uploading' && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
