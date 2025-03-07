document.addEventListener('DOMContentLoaded', () => {
  // Update the current year in the footer
  document.getElementById('current-year').textContent = new Date().getFullYear();
  
  // Load words from the API
  loadWords();
  
  // Set up subscription form toggle
  setupSubscriptionForm();
});

async function loadWords() {
  const loadingEl = document.getElementById('loading');
  const wordsContainerEl = document.getElementById('words-container');
  
  try {
    const response = await fetch('/.netlify/functions/getWords');
    
    if (!response.ok) {
      throw new Error('Failed to fetch words');
    }
    
    const data = await response.json();
    
    if (!data.words || !data.words.length) {
      wordsContainerEl.innerHTML = '<p class="no-words">Nenhuma palavra encontrada.</p>';
      return;
    }
    
    // Display words
    data.words.forEach(word => {
      wordsContainerEl.appendChild(createWordCard(word));
    });
    
  } catch (error) {
    console.error('Error loading words:', error);
    wordsContainerEl.innerHTML = '<p class="error-message">Ocorreu um erro ao carregar as palavras. Por favor, tente novamente mais tarde.</p>';
  } finally {
    // Hide loading indicator
    loadingEl.style.display = 'none';
  }
}

function createWordCard(wordData) {
  const template = document.getElementById('word-card-template');
  const clone = document.importNode(template.content, true);
  
  // Fill in word card data
  const wordEl = clone.querySelector('.word-card');
  const frontWord = clone.querySelector('.word-card-front .word');
  const backWord = clone.querySelector('.word-card-back .word');
  const syllablesEl = clone.querySelector('.syllables');
  const wordClassEl = clone.querySelector('.word-class');
  const dateEl = clone.querySelector('.date');
  const meaningEl = clone.querySelector('.meaning');
  const etymologyEl = clone.querySelector('.etymology');
  const etymologyContainer = clone.querySelector('.etymology-container');
  const dictionaryLink = clone.querySelector('.dictionary-link');
  
  // Set data
  frontWord.textContent = wordData.word;
  backWord.textContent = wordData.word;
  
  if (wordData.syllables) {
    syllablesEl.textContent = wordData.syllables;
  } else {
    syllablesEl.style.display = 'none';
  }
  
  // Handle word classes (both new array format and legacy single string format)
  if (wordData.wordClasses && Array.isArray(wordData.wordClasses) && wordData.wordClasses.length > 0) {
    wordClassEl.innerHTML = formatWordClasses(wordData.wordClasses);
  } else if (wordData.wordClass) {
    wordClassEl.textContent = wordData.wordClass;
  } else {
    wordClassEl.style.display = 'none';
  }
  
  if (wordData.date) {
    dateEl.textContent = wordData.date;
  } else {
    dateEl.style.display = 'none';
  }
  
  // Handle meanings (both new array format and legacy single string format)
  if (wordData.meanings && Array.isArray(wordData.meanings) && wordData.meanings.length > 0) {
    meaningEl.innerHTML = formatMeanings(wordData.meanings);
  } else if (wordData.meaning) {
    meaningEl.textContent = wordData.meaning;
  } else {
    meaningEl.textContent = 'Significado não disponível.';
  }
  
  if (wordData.etymology) {
    etymologyEl.textContent = wordData.etymology;
  } else {
    etymologyContainer.style.display = 'none';
  }
  
  // Create scrollable container and move meaning and etymology inside it
  const scrollableContent = document.createElement('div');
  scrollableContent.className = 'scrollable-content';
  
  // Insert the scrollable container after the word heading
  backWord.parentNode.insertBefore(scrollableContent, meaningEl);
  
  // Move meaning and etymology container into the scrollable content
  scrollableContent.appendChild(meaningEl);
  scrollableContent.appendChild(etymologyContainer);
  
  if (wordData.link) {
    dictionaryLink.href = wordData.link;
  } else {
    dictionaryLink.style.display = 'none';
  }
  
  // Add click event to flip the card
  wordEl.addEventListener('click', () => {
    wordEl.classList.toggle('flipped');
  });
  
  return wordEl;
}

/**
 * Format word classes as a comma-separated list
 */
function formatWordClasses(wordClasses) {
  return wordClasses.join(' e ');
}

/**
 * Format meanings as a structured list grouped by word class
 */
function formatMeanings(meanings) {
  // Group meanings by word class
  const meaningsByClass = {};
  
  meanings.forEach(meaning => {
    const wordClass = meaning.wordClass || 'Outro';
    if (!meaningsByClass[wordClass]) {
      meaningsByClass[wordClass] = [];
    }
    meaningsByClass[wordClass].push(meaning);
  });
  
  // Generate HTML
  let html = '';
  
  for (const wordClass in meaningsByClass) {
    // Add word class header if we have more than one class
    if (Object.keys(meaningsByClass).length > 1) {
      html += `<div class="meaning-class">${wordClass}</div>`;
    }
    
    // Add meaning items
    html += '<ul class="meaning-list">';
    meaningsByClass[wordClass].forEach(meaning => {
      html += `<li><span class="meaning-number">${meaning.number || ''}</span> ${meaning.text}</li>`;
    });
    html += '</ul>';
  }
  
  return html;
}

function setupSubscriptionForm() {
  const subscriptionBtn = document.getElementById('subscription-button');
  const formContainer = document.getElementById('subscription-form-container');
  const cancelBtn = document.getElementById('cancel-subscription');
  const form = document.getElementById('subscription-form');
  const messageEl = document.getElementById('subscription-message');

  // Close form if click is outside the subscription form container
  function outsideClickHandler(e) {
    if (!formContainer.contains(e.target) && e.target !== subscriptionBtn) {
      formContainer.classList.add('hidden');
      document.body.classList.remove('blurred');
      document.removeEventListener('click', outsideClickHandler);
      form.reset();
      messageEl.className = 'subscription-message';
      messageEl.textContent = '';
    }
  }

  subscriptionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (formContainer.classList.contains('hidden')) {
      formContainer.classList.remove('hidden');
      document.body.classList.add('blurred');
      setTimeout(() => {
        document.addEventListener('click', outsideClickHandler);
      }, 0);
    } else {
      formContainer.classList.add('hidden');
      document.body.classList.remove('blurred');
      document.removeEventListener('click', outsideClickHandler);
    }
  });

  cancelBtn.addEventListener('click', () => {
    formContainer.classList.add('hidden');
    document.body.classList.remove('blurred');
    document.removeEventListener('click', outsideClickHandler);
    form.reset();
    messageEl.className = 'subscription-message';
    messageEl.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!email || !validateEmail(email)) {
      showMessage('Por favor, insira um endereço de e-mail válido.', 'error');
      return;
    }
    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
      const response = await fetch('/.netlify/functions/submitEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }
      showMessage('Email subscrito com sucesso!', 'success');
      form.reset();
      setTimeout(() => {
        formContainer.classList.add('hidden');
        document.body.classList.remove('blurred');
        document.removeEventListener('click', outsideClickHandler);
        messageEl.className = 'subscription-message';
        messageEl.textContent = '';
      }, 3000);
    } catch (error) {
      console.error('Error submitting email:', error);
      showMessage(error.message || 'Ocorreu um erro. Por favor, tente novamente.', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Subscrever';
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `subscription-message ${type}`;
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
}
