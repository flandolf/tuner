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
const App = () => {
  const [micDevices, setMicDevices] = useState<string[]>([]);
  const [mic, setMic] = useState<string>("");
  const [micPerm, setMicPerm] = useState<boolean>(false);
  const [pitch, setPitch] = useState<string>("");
  const [closestNote, setClosestNote] = useState<string>("");
  const [clarity, setClarity] = useState<number>(0);
  const [centsOff, setCentsOff] = useState<number>(0);
  const [percentageInTune, setPercentageInTune] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const permissionName = "microphone" as PermissionName;
  useEffect(() => {
    // Check microphone permission status on page load
    navigator.permissions.query({ name: permissionName }).then((result) => {
      if (result.state === "granted") {
        setMicPerm(true);
      } else if (result.state === "denied") {
        setMicPerm(false);
      }
    });
    getMicDevices();
  }, []);

  const getMicDevices = () => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        devices.forEach((device) => {
          if (device.kind === "audioinput") {
            setMicDevices((prev) => [...prev, device.label]);
            // Remove Duplicates
            setMicDevices((prev) =>
              prev.filter((v, i, a) => a.indexOf(v) === i)
            );
          }
        });
      })
      .catch((err) => {
        console.log(err.name + ": " + err.message);
      });
  };

  const handleMicPerm = () => {
    navigator.permissions.query({ name: permissionName }).then((result) => {
      if (result.state === "granted") {
        setMicPerm(true);
      } else if (result.state === "prompt") {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(() => {
            setMicPerm(true);
          })
          .catch((err) => {
            console.log(err.name + ": " + err.message);
          });
      } else if (result.state === "denied") {
        return;
      }
      result.onchange = () => {
        console.log(result.state);
      };
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
    <div className="p-4 text-2xl space-y-2 flex flex-col align-middle justify-center">
      <div className="flex flex-row">
        <h1 className="font-semibold text-7xl text-green-500">"Tuner"</h1>
        <p className="text-2xl">Version 2.0.0</p>
      </div>
      {!micPerm && (
        <Button onClick={handleMicPerm}>Request Microphone Permission</Button>
      )}
      {micPerm && micDevices != [] && (
        <Select
          onValueChange={(e) => {
            setMic(e);
          }}
        >
          <SelectTrigger>{mic || "Select Microphone"}</SelectTrigger>
          <SelectContent>
            {micDevices.map((device, index) => (
              <SelectItem key={index} value={device}>
                {device}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <h2>Microphone Permission: {micPerm ? "Granted" : "Denied"}</h2>
      <Button onClick={start} disabled={!micPerm || running}>
        {running ? "Running" : "Start"}
      </Button>
      <div className="rounded-lg py-4 w-full">
        <div className="flex flex-col items-center justify-center">
          <div className="text-8xl font-bold mb-4">
            <span className="text-green-500">{closestNote}</span>
          </div>
          <div className="w-full mb-8">
            <Progress
              value={percentageInTune * 100}
              color={percentageInTune >= 0.5 ? "green" : "red"}
            />
          </div>
          <div className="text-2xl font-medium">
            <span className="text-green-500">
              {percentageInTune >= 0.5 ? "In Tune" : "Out of Tune"}
            </span>{" "}
            | {centsOff.toFixed(0)} cents
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-400">
        <p className="text-base">Raw Data: </p>
        <p>Pitch: {pitch}</p>
        <p>Closest Note: {closestNote}</p>
        <p>Clarity: {clarity}</p>
        <p>Cents Off: {centsOff}</p>
        <p>Percentage In Tune: {percentageInTune}</p>
        <p className="max-w-[40vw]">
          This app is relatively accurate, but may not be perfect. It works best
          with a clean tone, however, it can still work with distortion or other
          effects. It should be used as a tool to help you tune your instrument,
          but it is not a replacement for a dedicated tuner. The microphone
          should be line out from your instrument or a microphone close to your
          instrument. The microphone should not be your computer's built-in
          microphone.
        </p>
        <p className="text-green-500">&copy; 2024 Andy Wang</p>
      </div>
    </div>
  );
};

export default App;
