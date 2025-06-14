

export function speakText(text: string, lang: string = "km-KH") {
  if (!window.speechSynthesis) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  // Get voices (may be empty on first call, so force load)
  let voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    // Chrome loads voices asynchronously
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      setVoiceAndSpeak();
    };
  } else {
    setVoiceAndSpeak();
  }
    function setVoiceAndSpeak() {
        // Find a Khmer voice if available
        const khmerVoice = voices.find(voice => voice.lang.startsWith("km"));
        utterance.voice = khmerVoice || voices[0]; // Fallback to first available voice
        window.speechSynthesis.speak(utterance);
    }
}