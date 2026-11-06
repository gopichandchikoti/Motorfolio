import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Camera as CameraIcon } from 'lucide-react';
import { errorText, fileData } from './storage';
import { Field } from './ui';

export function AttachmentField({
  label,
  name,
  imagesOnly = false,
  existingName,
  onSelect,
}: {
  label: string;
  name: string;
  imagesOnly?: boolean;
  existingName?: string;
  onSelect: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const select = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      await fileData(file);
      onSelect(file);
      setSelectedName(file.name);
    } catch (cause) {
      setError(errorText(cause));
    }
  };
  const capture = async () => {
    if (!Capacitor.isNativePlatform()) {
      input.current?.click();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const photo = await Camera.takePhoto({
        quality: 75,
        targetWidth: 1600,
        targetHeight: 1600,
        saveToGallery: false,
      });
      if (!photo.webPath) throw new Error('Camera returned no photo. You can still import an image.');
      const response = await fetch(photo.webPath);
      if (!response.ok) throw new Error('The captured photo could not be read. Try importing an image.');
      const blob = await response.blob();
      await select(new File([blob], `${name}-photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
    } catch (cause) {
      setError(`${errorText(cause)} You can still choose a file.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wide">
      <Field label={label}>
        <input
          name={name}
          type="file"
          accept={`image/png,image/jpeg,image/webp${imagesOnly ? '' : ',application/pdf'}`}
          onChange={(event) => {
            void select(event.target.files?.[0]);
          }}
        />
        <small>{selectedName || existingName || 'Stored locally. Included in full encrypted backups.'}</small>
      </Field>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label={`Camera file for ${name}`}
        onChange={(event) => {
          void select(event.target.files?.[0]);
        }}
      />
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => {
          void capture();
        }}
      >
        <CameraIcon size={16} /> {busy ? 'Opening camera…' : `Capture ${imagesOnly ? 'vehicle' : 'receipt'} photo`}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
