import React, { useState, useRef } from "react";

interface VoiceDescriptionProps {
  onAudioReady?: (blob: Blob, url: string) => void;
}

export default function VoiceDescription({ onAudioReady }: VoiceDescriptionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        onAudioReady?.(audioBlob, url);
        audioChunks.current = [];
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied or not available:", error);
      alert("Please allow microphone access to record voice.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
      <div className="flex items-center mb-3">
        <span className="bg-blue-100 p-2 rounded-full">🎤</span>
        <h3 className="ml-3 text-sm font-semibold text-gray-800">Voice Description</h3>
      </div>

      <p className="text-gray-600 text-sm mb-3">
        Record a short voice note to include with your report.
      </p>

      {!isRecording ? (
        <button
          onClick={startRecording}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg shadow hover:bg-blue-700 transition"
          type="button"
        >
          🎙️ Start Recording
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-lg shadow hover:bg-red-700 transition"
          type="button"
        >
          ⏹️ Stop Recording
        </button>
      )}

      {audioURL && (
        <div className="mt-3">
          <p className="text-gray-700 text-sm font-medium mb-2">Preview:</p>
          <audio controls src={audioURL} className="w-full" />
        </div>
      )}
    </div>
  );
}


