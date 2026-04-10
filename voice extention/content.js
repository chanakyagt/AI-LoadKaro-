let activeElement = null;
let recognition = null;
let finalTranscript = "";

const micBtn = document.createElement("button");
micBtn.id = "voice-floating-mic";
micBtn.innerHTML = "🎤";
document.body.appendChild(micBtn);

const modal = document.createElement("div");
modal.id = "voice-dictation-modal";
modal.innerHTML = `
  <h3 style="margin:0 0 12px;">Voice Dictation</h3>
  <textarea id="voice-output" placeholder="Speak and your text will appear here..."></textarea>
  <div class="voice-actions">
    <button id="start-record">Start</button>
    <button id="stop-copy">Stop & Copy</button>
    <button id="clear-text">Clear</button>
  </div>
`;
document.body.appendChild(modal);

const output = modal.querySelector("#voice-output");
const startBtn = modal.querySelector("#start-record");
const stopCopyBtn = modal.querySelector("#stop-copy");
const clearBtn = modal.querySelector("#clear-text");

function isEditable(el) {
  return el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
}

document.addEventListener("focusin", (e) => {
  if (isEditable(e.target)) activeElement = e.target;
});

micBtn.addEventListener("click", () => {
  modal.style.display = modal.style.display === "block" ? "none" : "block";
});

function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition is not supported in this browser.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

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
    output.value = (finalTranscript + interim).trim();
  };
}

startBtn.addEventListener("click", () => {
  if (!recognition) initRecognition();
  recognition?.start();
});

stopCopyBtn.addEventListener("click", async () => {
  recognition?.stop();
  const text = output.value.trim();
  if (!text) return;

  await navigator.clipboard.writeText(text);

  if (activeElement) {
    activeElement.focus();
    if (activeElement.isContentEditable) {
      activeElement.innerText += text;
    } else {
      const start = activeElement.selectionStart || 0;
      const end = activeElement.selectionEnd || 0;
      const val = activeElement.value;
      activeElement.value = val.slice(0, start) + text + val.slice(end);
      activeElement.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  modal.style.display = "none";
});

clearBtn.addEventListener("click", () => {
  recognition?.stop();
  finalTranscript = "";
  output.value = "";
});

window.addEventListener("beforeunload", () => recognition?.stop());

