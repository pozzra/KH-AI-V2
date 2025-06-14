

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
    const khmerVoice = voices.find(v => v.lang === lang);
    if (khmerVoice) {
      utterance.voice = khmerVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      alert("សូមអភ័យទោស! កម្មវិធីមិនគាំទ្រអានភាសាខ្មែរនៅលើ browser នេះទេ។\nSorry, Khmer speech synthesis is not supported in this browser.");
    }
  }
}