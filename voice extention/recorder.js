const recordBtn = document.getElementById("recordBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const transcriptBox = document.getElementById("transcript");
const status = document.getElementById("status");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let isRecording = false;
let finalTranscript = "";
let micStream = null;

async function requestMicPermission() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (err) {
    status.textContent = "Mic permission denied";
    return false;
  }
}

function stopMicStream() {
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isRecording = true;
    status.textContent = "Listening...";
    recordBtn.textContent = "🎙 Recording";
  };

  recognition.onresult = (event) => {
    let interim = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += text + " ";
      } else {
        interim += text;
      }
    }

    transcriptBox.value = finalTranscript + interim;
  };

  recognition.onerror = (e) => {
    status.textContent = `Error: ${e.error}`;
  };

  recognition.onend = () => {
    isRecording = false;
    stopMicStream();
    recordBtn.textContent = "🎤 Start";
    status.textContent = "Stopped";
  };
}

recordBtn.addEventListener("click", async () => {
  if (!recognition) {
    status.textContent = "Speech recognition not supported";
    return;
  }

  if (!isRecording) {
    const ok = await requestMicPermission();
    if (!ok) return;

    try {
      recognition.start();
    } catch (err) {
      console.error(err);
    }
  } else {
    recognition.stop();
  }
});

copyBtn.addEventListener("click", async () => {
  if (isRecording) recognition.stop();

  const text = transcriptBox.value.trim();
  if (!text) return;

  await navigator.clipboard.writeText(text);
  status.textContent = "Copied";
});

clearBtn.addEventListener("click", () => {
  finalTranscript = "";
  transcriptBox.value = "";
  status.textContent = "Cleared";
});
