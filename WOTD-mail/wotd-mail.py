import requests
import re
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import xml.etree.ElementTree as ET
import logging
from bs4 import BeautifulSoup
import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("wotd.log"),
        logging.StreamHandler()
    ]
)

def get_word_of_the_day():
    """Fetch and extract the detailed word of the day from Priberam Dictionary."""
    url = "https://dicionario.priberam.org/DoDiaRSS.aspx"
    try:
        response = requests.get(url)
        response.raise_for_status()
        content = response.text
        
        try:
            root = ET.fromstring(content)
        except ET.ParseError as e:
            logging.error(f"XML Parse Error: {e}\nContent causing error:\n{content}")
            return None
        
        # Extract the first item from the RSS feed
        item = root.find('.//item')
        if item is None:
            logging.error("No item found in RSS feed.")
            return None
        
        # Extract word
        word_element = item.find('title')
        word = word_element.text if word_element is not None else None
        if not word:
            logging.error("No title (word) found in RSS item.")
            return None
            
        # Extract link
        link_element = item.find('link')
        link = link_element.text if link_element is not None else f"https://dicionario.priberam.org/{word}"

        # Extract date
        pub_date_element = item.find('pubDate')
        date_str = pub_date_element.text if pub_date_element is not None else None
        
        if date_str:
            try:
                date_obj = datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S %Z')
                date = date_obj.strftime('%d %b %Y')
            except ValueError:
                try:
                    date_obj = datetime.strptime(date_str, '%d %b %Y')
                    date = date_obj.strftime('%d %b %Y')
                except ValueError as e:
                    logging.error(f"Date parsing error: {e}. date_str: {date_str}")
                    date = datetime.now().strftime("%d %b %Y")
        else:
            date = datetime.now().strftime("%d %b %Y")

        # Extract description (HTML content)
        desc_element = item.find('description')
        description = desc_element.text if desc_element is not None else None
        
        if not description:
            logging.error("No description found in RSS item.")
            return None

        # Parse the HTML content
        soup = BeautifulSoup(description, 'html.parser')
        
        # Extract syllables
        syllables_element = soup.select_one('.dp-divisao-silabica .titpalavra')
        syllables = syllables_element.text.strip() if syllables_element else ""
        
        # Extract word classes and meanings
        word_classes = []
        meanings = []
        current_class = ''
        
        # First get all word classes
        for class_elem in soup.select('.--pequeno'):
            class_text = class_elem.text.strip()
            if class_text and not class_text.startswith('1.') and not class_text.startswith('2.'):
                word_classes.append(class_text)
                
        # Now go through elements to get meanings with their classes
        class_and_def_elements = soup.select('.--pequeno, .dp-definicao-linha')
        
        for element in class_and_def_elements:
            if 'dp-definicao-linha' not in element.get('class', []):
                class_text = element.text.strip()
                if class_text and not class_text.startswith('1.') and not class_text.startswith('2.'):
                    current_class = class_text
            else:  # It's a definition line
                number_elem = element.select_one('.h6.--pequeno')
                text_elem = element.select_one('.p')
                
                if text_elem:
                    number = number_elem.text.strip() if number_elem else ""
                    text = text_elem.text.strip()
                    meanings.append({
                        "number": number,
                        "text": text,
                        "wordClass": current_class
                    })
        
        # Extract etymology
        etymology_elem = soup.select_one('.dp-seccao-icon .def.p')
        etymology = etymology_elem.text.strip() if etymology_elem else ""
        
        return {
            "word": word,
            "link": link,
            "date": date,
            "syllables": syllables,
            "wordClasses": word_classes,
            "meanings": meanings,
            "etymology": etymology
        }

    except requests.exceptions.RequestException as e:
        logging.error(f"Request Exception: {e}")
        return None
    except Exception as e:
        logging.error(f"General Error fetching word of the day: {e}")
        return None

def get_subscribers_from_supabase():
    """Get email subscribers from Supabase database."""
    try:
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            logging.error("Supabase credentials not found in environment variables")
            return []
            
        supabase = create_client(supabase_url, supabase_key)
        
        # Fetch subscribers from the 'subscribers' table
        response = supabase.table("subscribers").select("email").execute()
        print(response)
        
        if hasattr(response, 'data'):
            # Extract email addresses from response data
            emails = [subscriber['email'] for subscriber in response.data]
            logging.info(f"Fetched {len(emails)} subscribers from Supabase")
            return emails
        else:
            logging.error(f"Unexpected response format from Supabase: {response}")
            return []
            
    except Exception as e:
        logging.error(f"Error fetching subscribers from Supabase: {e}")
        return []

def send_emails(word_data, recipients, sender_email, password):
    """Send formatted emails to all recipients with detailed word information."""
    if not word_data:
        logging.error("No word data to send in email")
        return
        
    # Create message
    subject = f"Palavra do Dia Priberam: {word_data['word']} - {word_data['date']}"
    
    # Create meanings HTML
    meanings_html = ""
    for meaning in word_data['meanings']:
        meanings_html += f"""
        <div class="meaning-item">
            <div class="meaning-header">
                <span class="meaning-number">{meaning['number']}</span>
                <span class="meaning-class">{meaning['wordClass']}</span>
            </div>
            <div class="meaning-content">
                <p>{meaning['text']}</p>
            </div>
        </div>
        """
    
    # Create word classes HTML
    word_classes_html = ", ".join(word_data['wordClasses']) if word_data['wordClasses'] else ""
    
    html = f"""
    <html>
      <head>
        <style>
          body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1a202c;
            background-color: #f7fafc;
            margin: 0;
            padding: 0;
          }}
          .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }}
          .header {{
            background-color: #4299e1;
            color: white;
            padding: 20px;
            text-align: center;
          }}
          .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }}
          .header p {{
            margin: 5px 0 0;
            font-size: 16px;
            opacity: 0.9;
          }}
          .content {{
            padding: 25px;
          }}
          .word-section {{
            margin-bottom: 25px;
            text-align: center;
          }}
          .word {{
            font-size: 32px;
            font-weight: 700;
            color: #2b6cb0;
            margin: 0;
            line-height: 1.2;
          }}
          .syllables {{
            font-size: 20px;
            color: #4a5568;
            margin: 5px 0 0;
          }}
          .word-classes {{
            display: inline-block;
            margin-top: 8px;
            font-style: italic;
            color: #718096;
            padding: 3px 8px;
            border-radius: 4px;
            background-color: #edf2f7;
          }}
          .section-title {{
            font-size: 18px;
            font-weight: 600;
            color: #4a5568;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
            margin-top: 25px;
            margin-bottom: 15px;
          }}
          .meaning-item {{
            margin-bottom: 18px;
            padding-left: 10px;
            border-left: 3px solid #bee3f8;
          }}
          .meaning-header {{
            display: flex;
            align-items: baseline;
            margin-bottom: 5px;
          }}
          .meaning-number {{
            font-weight: 600;
            color: #2b6cb0;
            margin-right: 8px;
          }}
          .meaning-class {{
            font-style: italic;
            color: #718096;
            font-size: 14px;
          }}
          .meaning-content p {{
            margin: 0;
            color: #2d3748;
          }}
          .etymology-section {{
            margin-top: 25px;
            padding: 15px;
            background-color: #f7fafc;
            border-radius: 6px;
          }}
          .etymology-section p {{
            margin: 0;
            font-style: italic;
            color: #718096;
          }}
          .link-section {{
            margin-top: 25px;
            text-align: center;
          }}
          .link-section a {{
            color: #4299e1;
            text-decoration: none;
            font-weight: 500;
          }}
          .link-section a:hover {{
            text-decoration: underline;
          }}
          .footer {{
            background-color: #edf2f7;
            padding: 15px;
            text-align: center;
            font-size: 13px;
            color: #718096;
          }}
          .footer p {{
            margin: 5px 0;
          }}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Palavra do Dia</h1>
            <p>{word_data['date']}</p>
          </div>
          <div class="content">
            <div class="word-section">
              <h2 class="word">{word_data['word']}</h2>
              <p class="syllables">{word_data['syllables']}</p>
              <div class="word-classes">{word_classes_html}</div>
            </div>
            
            <h3 class="section-title">Significados</h3>
            <div class="meanings-section">
              {meanings_html}
            </div>
            
            <div class="etymology-section">
              <h3 class="section-title">Etimologia</h3>
              <p>{word_data['etymology'] or 'Não disponível'}</p>
            </div>
            
            <div class="link-section">
              <a href="{word_data['link']}" target="_blank">Ver no Dicionário Priberam</a>
            </div>
          </div>
          <div class="footer">
            <p>Este email é enviado automaticamente por um Raspberry :)</p>
          </div>
        </div>
      </body>
    </html>
    """
    
    # Setup secure connection with server
    context = ssl.create_default_context()
    
    # Connect to Gmail's SMTP server
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        try:
            server.login(sender_email, password)
            
            for recipient in recipients:
                # Create a new message for each recipient
                message = MIMEMultipart("alternative")
                message["Subject"] = subject
                message["From"] = sender_email
                message["To"] = recipient
                
                # Add HTML content
                message.attach(MIMEText(html, "html"))
                
                try:
                    # Send email
                    server.sendmail(sender_email, recipient, message.as_string())
                    logging.info(f"Email sent to {recipient}")
                except Exception as e:
                    logging.error(f"Error sending to {recipient}: {e}")
                
        except Exception as e:
            logging.error(f"Error with email server: {e}")

def load_recipients_from_file(filename="./users.txt"):
    """Load email recipients from file (fallback method)."""
    try:
        with open(filename, 'r') as file:
            # Strip whitespace and filter out empty lines
            emails = [line.strip() for line in file if line.strip()]
        return emails
    except FileNotFoundError:
        logging.error(f"Error: {filename} not found.")
        return []

def send_daily_word():
    """Main function to send the daily word to all subscribers."""
    logging.info("Starting daily word of the day email service...")
    
    # Load environment variables if not already loaded
    if not os.getenv("EMAIL_PASSWORD"):
        load_dotenv()
    
    # Your Gmail credentials
    sender_email = os.getenv("EMAIL_ADDRESS")
    password = os.getenv("EMAIL_PASSWORD")
    
    # Get word of the day with detailed info
    word_data = get_word_of_the_day()

    if not word_data:
        logging.error("Failed to retrieve the word of the day.")
        return
        
    logging.info(f"Word of the day: {word_data['word']}")
    
    # Get recipients from Supabase
    recipients = get_subscribers_from_supabase()
    
    # Fallback to file if no recipients from Supabase
    if not recipients:
        logging.warning("No recipients found in Supabase, falling back to file.")
        recipients = load_recipients_from_file()
    
    if not recipients:
        logging.error("No recipients found.")
        return
    
    logging.info(f"Sending emails to {len(recipients)} recipients")
    
    # Send emails
    send_emails(word_data, recipients, sender_email, password)
    
    logging.info("Daily word of the day email service completed.")

def main():
    """Run the word of the day process once."""
    send_daily_word()

if __name__ == "__main__":
    main()