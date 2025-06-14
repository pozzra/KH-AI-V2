type Speaker = { speak: () => void };
const speakers: Speaker[] = [];
speakers.push({ speak: () => console.log('Hello!') });
speakers[0].speak();

export function speakText(text: string, lang: string = "km-KH") {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }

  const utterance: SpeechSynthesisUtterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  // Helper to select voice and speak
  function setVoiceAndSpeak(voices: SpeechSynthesisVoice[]) {
    const khmerVoice = voices.find(v => v.lang === lang);
    if (khmerVoice) {
      utterance.voice = khmerVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      alert(
        "សូមអភ័យទោស! កម្មវិធីមិនគាំទ្រអានភាសាខ្មែរនៅលើ browser នេះទេ។\nSorry, Khmer speech synthesis is not supported in this browser."
      );
    }
  }

  // Some browsers load voices asynchronously
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    setVoiceAndSpeak(voices);
  } else if ("onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      setVoiceAndSpeak(window.speechSynthesis.getVoices());
    };
  } else {
    // Fallback: try to speak anyway
    window.speechSynthesis.speak(utterance);
  }
}