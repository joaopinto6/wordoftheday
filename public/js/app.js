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
  const dictionaryLink = clone.querySelector('.dictionary-link');
  
  // Set data
  frontWord.textContent = wordData.word;
  backWord.textContent = wordData.word;
  
  if (wordData.syllables) {
    syllablesEl.textContent = wordData.syllables;
  } else {
    syllablesEl.style.display = 'none';
  }
  
  if (wordData.wordClass) {
    wordClassEl.textContent = wordData.wordClass;
  } else {
    wordClassEl.style.display = 'none';
  }
  
  if (wordData.date) {
    dateEl.textContent = wordData.date;
  } else {
    dateEl.style.display = 'none';
  }
  
  if (wordData.meaning) {
    meaningEl.textContent = wordData.meaning;
  } else {
    meaningEl.textContent = 'Significado não disponível.';
  }
  
  if (wordData.etymology) {
    etymologyEl.textContent = wordData.etymology;
  } else {
    etymologyEl.closest('.etymology-container').style.display = 'none';
  }
  
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

function setupSubscriptionForm() {
  const subscriptionBtn = document.getElementById('subscription-button');
  const formContainer = document.getElementById('subscription-form-container');
  const cancelBtn = document.getElementById('cancel-subscription');
  const form = document.getElementById('subscription-form');
  const messageEl = document.getElementById('subscription-message');
  
  // Toggle form visibility
  subscriptionBtn.addEventListener('click', () => {
    formContainer.classList.toggle('hidden');
  });
  
  // Close form
  cancelBtn.addEventListener('click', () => {
    formContainer.classList.add('hidden');
    // Reset form
    form.reset();
    messageEl.className = 'subscription-message';
    messageEl.textContent = '';
  });
  
  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    
    // Simple client-side validation
    if (!email || !validateEmail(email)) {
      showMessage('Por favor, insira um endereço de e-mail válido.', 'error');
      return;
    }
    
    try {
      // Show loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
      
      // Submit email to API
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
      
      // Show success message
      showMessage('Email subscrito com sucesso!', 'success');
      form.reset();
      
      // Automatically hide the form after 3 seconds
      setTimeout(() => {
        formContainer.classList.add('hidden');
        messageEl.className = 'subscription-message';
        messageEl.textContent = '';
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting email:', error);
      showMessage(error.message || 'Ocorreu um erro. Por favor, tente novamente.', 'error');
    } finally {
      // Restore button state
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
