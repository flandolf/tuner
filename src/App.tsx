import "./App.css";
import { PitchDetector } from "pitchy";
import { useEffect, useState } from "react";
import { Note } from "tonal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Progress } from "./components/ui/progress";
import { ModeToggle } from "./components/mode-toggle";
const App = () => {
  const [micDevices, setMicDevices] = useState<Array<{id: string; label: string}>>([]);
  const [mic, setMic] = useState<string>("");
  const [micPerm, setMicPerm] = useState<boolean>(false);
  const [pitch, setPitch] = useState<string>("");
  const [closestNote, setClosestNote] = useState<string>("");
  const [clarity, setClarity] = useState<number>(0);
  const [centsOff, setCentsOff] = useState<number>(0);
  const [percentageInTune, setPercentageInTune] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true });
    getMicDevices();
  }, []);

  useEffect(() => {
    if (micPerm) {
      getMicDevices();
    }
  }, [micPerm]);

  const getMicDevices = () => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const audioDevices = devices
          .filter(device => device.kind === "audioinput")
          .map(device => ({
            id: device.deviceId,
            label: device.label || `Microphone ${device.deviceId}`
          }));
        setMicDevices(audioDevices);
      })
      .catch((err) => {
        console.log(err.name + ": " + err.message);
      });
  };

  const handleMicPerm = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
      setMicPerm(true);
    });
  };

  const updatePitch = (
    analyserNode: AnalyserNode,
    detector: PitchDetector<Float32Array>,
    input: Float32Array,
    sampleRate: number
  ) => {
    analyserNode.getFloatTimeDomainData(input);
    const [pitch, clarity] = detector.findPitch(input, sampleRate);

    if (clarity >= 0.95) {
      const frequency = pitch.toFixed(2);
      const closestNote = Note.fromFreq(parseFloat(frequency));
      const closestNoteFrequency = Note.freq(closestNote);

      // Calculate the difference in frequency in cents
      const centsOff =
        1200 * Math.log2(parseFloat(frequency) / closestNoteFrequency!);
      const percentageInTune = 1 - Math.abs(centsOff / 50);
      setPitch(frequency);
      setClosestNote(closestNote);
      setClarity(clarity);
      setCentsOff(centsOff);
      setPercentageInTune(percentageInTune);
    }

    window.setTimeout(
      () => updatePitch(analyserNode, detector, input, sampleRate),
      40
    );
  };

  const start = () => {
    if (!mic) {
      return;
    }

    if (running) {
      return;
    }

    setRunning(true);

    const audioContext = new window.AudioContext();
    const analyserNode = audioContext.createAnalyser();

    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: mic } } })
      .then((stream) => {
        audioContext.createMediaStreamSource(stream).connect(analyserNode);
        const detector = PitchDetector.forFloat32Array(analyserNode.fftSize);
        const input = new Float32Array(detector.inputLength);
        updatePitch(analyserNode, detector, input, audioContext.sampleRate);
      })
      .catch((err) => {
        console.log(err.name + ": " + err.message);
      });

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioContext.createMediaStreamSource(stream).connect(analyserNode);
      const detector = PitchDetector.forFloat32Array(analyserNode.fftSize);
      const input = new Float32Array(detector.inputLength);
      updatePitch(analyserNode, detector, input, audioContext.sampleRate);
    });
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center space-y-6 max-w-4xl mx-auto">
      <div className="flex items-baseline gap-4 mb-4">
        <h1 className="font-bold text-7xl bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">Tuner</h1>
        <p className="text-2xl text-muted-foreground">Version 2.1</p>
      </div>
      <div className="w-full max-w-md space-y-4">
        {!micPerm && (
          <Button onClick={handleMicPerm} className="w-full py-6 text-lg hover:scale-105 transition-transform">
            Request Microphone Permission
          </Button>
        )}
        {micPerm && (
          <Select
            onValueChange={(deviceId) => {
              setMic(deviceId);
            }}
          >
            <SelectTrigger className="w-full py-6 text-lg">
              {micDevices.find(d => d.id === mic)?.label || "Select Microphone"}
            </SelectTrigger>
            <SelectContent>
              {micDevices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
    
        <h2 className="text-xl text-center text-muted-foreground">
          Microphone Permission: {micPerm ? "Granted" : "Denied"}
        </h2>
        <Button 
          onClick={start} 
          disabled={!micPerm || running}
          className={`w-full py-6 text-lg ${running ? 'bg-green-500 hover:bg-green-600' : 'hover:scale-105'} transition-all`}
        >
          {running ? "Running" : "Start"}
        </Button>
      </div>
    
      <div className="w-full max-w-2xl rounded-xl bg-card p-8 shadow-lg transition-all">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="text-9xl font-bold mb-4 transition-all transform hover:scale-105">
            <span className={`${percentageInTune >= 0.8 ? 'text-green-500' : 'text-blue-500'}`}>
              {closestNote || '-'}
            </span>
          </div>
          <div className="w-full mb-8">
            <Progress
              value={percentageInTune * 100}
              className={`h-4 transition-all ${percentageInTune >= 0.8 ? 'bg-green-100' : 'bg-blue-100'}`}
            />
          </div>
          <div className="text-2xl font-medium text-center space-y-2">
            <span className={`block text-3xl font-bold ${percentageInTune >= 0.8 ? 'text-green-500' : 'text-blue-500'}`}>
              {percentageInTune >= 0.8 ? "In Tune" : "Out of Tune"}
            </span>
            <span className="text-muted-foreground">{centsOff.toFixed(0)} cents</span>
          </div>
        </div>
      </div>
    
      <div className="text-sm text-muted-foreground max-w-2xl">
        <div className="space-y-2 p-4 rounded-lg bg-card/50">
          <p className="text-base font-medium">Raw Data:</p>
          <div className="grid grid-cols-2 gap-2">
            <p>Pitch: {pitch || '-'}</p>
            <p>Closest Note: {closestNote || '-'}</p>
            <p>Clarity: {clarity.toFixed(2)}</p>
            <p>Cents Off: {centsOff.toFixed(1)}</p>
            <p>Percentage In Tune: {(percentageInTune * 100).toFixed(1)}%</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed">
          This app is relatively accurate, but may not be perfect. It works best
          with a clean tone, however, it can still work with distortion or other
          effects. It should be used as a tool to help you tune your instrument,
          but it is not a replacement for a dedicated tuner. The microphone
          should be line out from your instrument or a microphone close to your
          instrument. The microphone should not be your computer's built-in
          microphone.
        </p>
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-blue-500">&copy; 2024 Andy Wang</p>
          <ModeToggle />
        </div>
      </div>
    </div>
  );
};

export default App;
