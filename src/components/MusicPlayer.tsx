// src/components/MusicPlayer.tsx
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

type MusicPlayerProps = {
  playlist: string[]; // array of urls (local public/* or remote)
  autoPlay?: boolean;
  initialIndex?: number;
  className?: string;
};

export type MusicPlayerHandle = {
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  isPlaying: () => boolean;
};

const MusicPlayer = forwardRef<MusicPlayerHandle, MusicPlayerProps>((props, ref) => {
  const { playlist = [], autoPlay = false, initialIndex = 0, className } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);

  useImperativeHandle(ref, () => ({
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
    next: () => {
      const next = (index + 1) % playlist.length;
      setIndex(next);
    },
    prev: () => {
      const prev = (index - 1 + playlist.length) % playlist.length;
      setIndex(prev);
    },
    isPlaying: () => playing,
  }));

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    // autoPlay if requested
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }

  return (
    <div className={`bg-gray-50 border p-3 rounded flex items-center gap-3 ${className || ""}`}>
      <audio
        ref={audioRef}
        src={playlist[index]}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setIndex((i) => (i + 1) % playlist.length)}
        controls={false}
      />
      <div className="flex items-center gap-2">
        <button onClick={() => setIndex((i) => (i - 1 + playlist.length) % playlist.length)} className="px-2 py-1 bg-gray-200 rounded">Prev</button>
        <button onClick={togglePlay} className="px-3 py-1 bg-blue-600 text-white rounded">{playing ? "Pause" : "Play"}</button>
        <button onClick={() => setIndex((i) => (i + 1) % playlist.length)} className="px-2 py-1 bg-gray-200 rounded">Next</button>
      </div>

      <div className="ml-4 text-sm text-gray-700">
        <div className="font-medium">{playlist[index] ? playlist[index].split("/").pop() : "No track"}</div>
        <div className="text-xs text-gray-500">Track {index + 1} / {playlist.length}</div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs text-gray-600">Vol</label>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
      </div>
    </div>
  );
});

export default MusicPlayer;
