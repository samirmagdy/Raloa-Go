import { auth, isE2ETestMode } from './firebase';

export type MediaPurpose = 'gallery' | 'product' | 'background' | 'block' | 'avatar';

export interface UploadedMedia {
  id: string;
  src: string;
  thumbnail: string;
  publicUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  bytes: number;
  purpose: MediaPurpose;
}

export function uploadMedia(
  file: File,
  siteId: string,
  purpose: MediaPurpose,
  onProgress?: (percent: number) => void
): Promise<UploadedMedia> {
  return new Promise(async (resolve, reject) => {
    const user = auth.currentUser;
    if (!user && !isE2ETestMode) {
      reject(new Error('Authentication required.'));
      return;
    }
    try {
      const token = isE2ETestMode ? 'e2e-test-token' : await user!.getIdToken();
      const request = new XMLHttpRequest();
      request.open('POST', '/api/media/upload');
      request.setRequestHeader('Authorization', `Bearer ${token}`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () => reject(new Error('The media upload failed.'));
      request.onload = () => {
        let payload: any = null;
        try { payload = JSON.parse(request.responseText || '{}'); } catch (_) {}
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(payload?.error?.message || payload?.message || 'The media upload failed.'));
          return;
        }
        resolve(payload.media as UploadedMedia);
      };
      const form = new FormData();
      form.append('siteId', siteId);
      form.append('purpose', purpose);
      form.append('file', file);
      request.send(form);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('The media upload failed.'));
    }
  });
}
