import React from 'react';
import './TrackCover.styles.css';

// Definición de las propiedades (props) del componente
interface TrackCoverProps {
  fileName: string | null; // Nombre del archivo de la imagen (opcional)
  altText?: string; // Texto alternativo para la imagen (opcional)
}

// Componente funcional tipado
const TrackCover: React.FC<TrackCoverProps> = ({
  fileName,
  altText = 'track-cover', // Valor por defecto para altText
}) => {
  if (!fileName) return null;

  const fileNameWithoutExtension =
    fileName
      .split('/')
      .pop()
      ?.replace(/\.[^/.]+$/, '') || '';

  return (
    <img
      className="track-cover"
      src={`${import.meta.env.VITE_API_URL}/${fileNameWithoutExtension}.webp`} // Construcción de la URL de la imagen
      alt={altText} // Texto alternativo
      onError={e => {
        (e.target as HTMLImageElement).src = '/favicon.png'; // Ruta de la imagen de fallback
      }}
    />
  );
};

export default TrackCover;
