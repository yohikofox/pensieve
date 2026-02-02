/**
 * PlayerWrapper - Wrapper for integrating Spotify-style player with Capture
 */

import React from 'react';
import { Player } from './Player';

interface PlayerWrapperProps {
  audioUri: string;
  title: string;
  artist?: string;
}

export const PlayerWrapper: React.FC<PlayerWrapperProps> = ({
  audioUri,
  title,
  artist,
}) => {
  const tracks = [
    {
      title,
      artist,
      audioUrl: audioUri,
      albumArtUrl: undefined, // Could be capture thumbnail in future
    },
  ];

  return <Player tracks={tracks} />;
};
