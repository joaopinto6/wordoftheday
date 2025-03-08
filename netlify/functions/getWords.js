const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

exports.handler = async function(event, context) {
  try {
    // Fetch the RSS feed
    const response = await axios.get('https://dicionario.priberam.org/DoDiaRSS.aspx');
    const data = response.data;
    
    // Parse the data
    const words = [];
    const regex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = regex.exec(data)) !== null) {
      const itemContent = match[1];
      
      // Extract title (word)
      const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
      const word = titleMatch ? titleMatch[1] : '';
      
      // Extract link
      const linkMatch = /<link>(.*?)<\/link>/.exec(itemContent);
      const link = linkMatch ? linkMatch[1] : '';
      
      // Extract date
      const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
      const pubDate = dateMatch ? new Date(dateMatch[1]) : null;
      const date = pubDate ? pubDate.toLocaleDateString('pt-PT') : '';
      
      // Extract description (HTML content)
      const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemContent);
      let description = descMatch ? descMatch[1] : '';

      // Parse HTML content to extract more details
      if (description) {
        // Decode HTML entities before parsing
        const decodedDescription = decodeHTMLEntities(description);
        
        // Parse the decoded HTML
        const $ = cheerio.load(decodedDescription);
        
        // Extract pronunciation and syllables
        const syllables = $('.dp-divisao-silabica .titpalavra').text().trim();
        
        // Extract all word classes
        const wordClasses = [];
        $('.--pequeno').each(function() {
          const classText = $(this).text().trim();
          // Only include elements that have class descriptions (filter out empty or non-class elements)
          if (classText && !classText.startsWith('1.') && !classText.startsWith('2.')) {
            wordClasses.push(classText);
          }
        });
        
        // Extract all meanings with their corresponding numbers and classes
        const meanings = [];
        let currentClass = '';
        
        $('.--pequeno, .dp-definicao-linha').each(function() {
          const element = $(this);
          
          // If this is a class header, update the current class
          if (element.hasClass('--pequeno') && !element.text().trim().startsWith('1.') && !element.text().trim().startsWith('2.')) {
            currentClass = element.text().trim();
          }
          
          // If this is a definition line, extract the meaning
          if (element.hasClass('dp-definicao-linha')) {
            const numberEl = element.find('.h6.--pequeno').text().trim();
            const textEl = element.find('.p').text().trim();
            
            if (textEl) {
              meanings.push({
                number: numberEl,
                text: textEl,
                wordClass: currentClass
              });
            }
          }
        });
        
        // Extract etymology
        const etymology = $('.dp-seccao-icon .def.p').first().text().trim();
        
        words.push({
          word,
          link,
          date,
          syllables,
          wordClasses,
          meanings,
          etymology,
          fullDescription: description
        });
      } else {
        words.push({ word, link, date });
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ words })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch the words of the day' })
    };
  }
};
