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
        console.log(decodedDescription);
        console.log("-------------------------------------------------")
        
        // Parse the decoded HTML
        const $ = cheerio.load(decodedDescription);
        
        // Extract pronunciation and syllables
        const syllables = $('.dp-divisao-silabica .titpalavra').text().trim();
        
        // Extract word class (adjective, noun, etc)
        const wordClass = $('.--pequeno').first().text().trim();
        
        // Extract meaning
        const meaning = $('.dp-definicao-linha .p').first().text().trim();
        
        // Extract etymology
        const etymology = $('.dp-seccao-icon .def.p').first().text().trim();
        
        words.push({
          word,
          link,
          date,
          syllables,
          wordClass,
          meaning,
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
