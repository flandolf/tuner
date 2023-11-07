import { Select, Option, Button, LinearProgress } from '@mui/joy'
import './App.css'
import { PitchDetector } from 'pitchy'
import { useEffect, useState } from 'react'
import { Note } from 'tonal'
const App = () => {
  const [micDevices, setMicDevices] = useState<string[]>([])
  const [mic, setMic] = useState<string>('')
  const [micPerm, setMicPerm] = useState<boolean>(false)
  const [pitch, setPitch] = useState<string>('')
  const [closestNote, setClosestNote] = useState<string>('')
  const [clarity, setClarity] = useState<number>(0)
  const [centsOff, setCentsOff] = useState<number>(0)
  const [percentageInTune, setPercentageInTune] = useState<number>(0)
  const permissionName = "microphone" as PermissionName;
  useEffect(() => {

    // Check microphone permission status on page load
    navigator.permissions.query({ name: permissionName }).then((result) => {
      if (result.state === 'granted') {
        setMicPerm(true)
      } else if (result.state === 'denied') {
        setMicPerm(false)
      }
    })
    getMicDevices()
  }, [])

  const getMicDevices = () => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        devices.forEach((device) => {
          if (device.kind === 'audioinput') {
            setMicDevices((prev) => [...prev, device.label])
            // Remove Duplicates
            setMicDevices((prev) => prev.filter((v, i, a) => a.indexOf(v) === i))
          }
        })
      })
      .catch((err) => {
        console.log(err.name + ': ' + err.message)
      })
  }

  const handleChange = (_event: React.SyntheticEvent | null, newValue: string | null) => {
    setMic(newValue || '')
  }

  const handleMicPerm = () => {
    navigator.permissions.query({ name: permissionName }).then((result) => {
      if (result.state === 'granted') {
        setMicPerm(true)
      } else if (result.state === 'prompt') {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(() => {
            setMicPerm(true)
          })
          .catch((err) => {
            console.log(err.name + ': ' + err.message)
          })
      } else if (result.state === 'denied') {
        console.log('Permission denied')
      }
      result.onchange = () => {
        console.log(result.state)
      }
    })
  }

  const updatePitch = (
    analyserNode: AnalyserNode,
    detector: PitchDetector<Float32Array>,
    input: Float32Array,
    sampleRate: number
  ) => {
    analyserNode.getFloatTimeDomainData(input)
    const [pitch, clarity] = detector.findPitch(input, sampleRate)

    if (clarity >= 0.95) {
      const frequency = pitch.toFixed(2)
      const closestNote = Note.fromFreq(parseFloat(frequency))
      const closestNoteFrequency = Note.freq(closestNote)

      // Calculate the difference in frequency in cents
      const centsOff = 1200 * Math.log2(parseFloat(frequency) / closestNoteFrequency!)
      const percentageInTune = 1 - Math.abs(centsOff / 50)
      setPitch(frequency)
      setClosestNote(closestNote)
      setClarity(clarity)
      setCentsOff(centsOff)
      setPercentageInTune(percentageInTune)
    }

    window.setTimeout(() => updatePitch(analyserNode, detector, input, sampleRate), 100)
  }

  const start = () => {
    if (!mic) {
      console.log('No microphone selected')
      return
    }

    const audioContext = new window.AudioContext()
    const analyserNode = audioContext.createAnalyser()

    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: { exact: mic } } })
      .then((stream) => {
        audioContext.createMediaStreamSource(stream).connect(analyserNode)
        const detector = PitchDetector.forFloat32Array(analyserNode.fftSize)
        const input = new Float32Array(detector.inputLength)
        updatePitch(analyserNode, detector, input, audioContext.sampleRate)
      })
      .catch((err) => {
        console.log(err.name + ': ' + err.message)
      })

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioContext.createMediaStreamSource(stream).connect(analyserNode)
      const detector = PitchDetector.forFloat32Array(analyserNode.fftSize)
      const input = new Float32Array(detector.inputLength)
      updatePitch(analyserNode, detector, input, audioContext.sampleRate)
    })
  }

  return (
    <>
      <h1>Pitch Detection</h1>
      {/* Conditionally render the permission button based on micPerm */}
      {!micPerm && <Button onClick={handleMicPerm}>Request Microphone Permission</Button>}
      <Select
        sx={{
          margin: '1rem 0 1rem 0'
        }}
        onChange={handleChange}
      >
        {micDevices.map((device) => (
          <Option value={device} key={device}>
            {device}
          </Option>
        ))}
      </Select>
      <Button onClick={start} disabled={!micPerm}>
        Start
      </Button>
      <h2>Pitch: {pitch} Hz</h2>
      <h2>
        Closest Note: {closestNote} - {Note.freq(closestNote)?.toFixed(2)} Hz
      </h2>
      <h2>Clarity: {(clarity * 100).toFixed(2)}%</h2>
      <h2>Cents Off: {centsOff.toFixed(1)}</h2>
      {centsOff < 0 && <h1>Please Tune Up</h1>}
      {centsOff > 0 && <h1>Please Tune Down</h1>}
      <h1>Percentage in Tune:</h1>
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          gap: '10px'
        }}
      >
        <LinearProgress determinate variant="plain" value={percentageInTune * 100} />
        {(percentageInTune * 100).toFixed(2)}%
      </div>
    </>
  )
}

export default App
