from flask import Flask, request, jsonify, render_template
import csv
from transformers import pipeline
import re
import speech_recognition as sr
from pydub import AudioSegment
from pydub.playback import play
import os
import io
import warnings

AudioSegment.converter = "/usr/bin/ffmpeg"

os.environ["TRANSFORMERS_CACHE"] = "/tmp/huggingface_cache"
os.makedirs(os.environ["TRANSFORMERS_CACHE"], exist_ok=True)


warnings.filterwarnings("ignore", category=SyntaxWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # Limit to 10MB

# Load a language model pipeline for generating suitable replacements
fill_mask = pipeline("fill-mask", model="bert-base-uncased")  # Replace with a suitable model



@app.route('/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"})
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"})
    
    try:
        # Convert audio to WAV format if it's not already
        print(f"Received file: {file.filename}")
        
        audio = AudioSegment.from_file(file)
        print(f"Audio properties: {audio.frame_rate}, {audio.channels}, {audio.sample_width}")

        # Normalize the audio
        audio = audio.normalize()

        # Set a target duration (in milliseconds, e.g., 5 seconds)
        target_duration = 5 * 1000  # 5 seconds

        # Loop the audio until it meets the target duration
        while len(audio) < target_duration:
            audio += audio  # Repeat the audio

        # Trim the audio to exactly the target duration
        audio = audio[:target_duration]

        # Export the audio to WAV format with specific settings
        wav_io = io.BytesIO()
        audio.export(wav_io, format="wav", parameters=["-ar", "16000", "-ac", "1"])  # 16 kHz, mono
        wav_io.seek(0)

        # Use speech recognition to process the audio file
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_io) as audio_file:
            audio_data = recognizer.record(audio_file)
        
        # Try recognizing the speech
        try:
            text = recognizer.recognize_google(audio_data)
            print(f"Recognized text: {text}")
            return jsonify({"text": text})
        except sr.UnknownValueError:
            print("Could not understand the audio")
            return jsonify({"error": "Could not understand the audio"})
        except sr.RequestError as e:
            print(f"Request error: {e}")
            return jsonify({"error": f"Could not request results; {e}"})
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return jsonify({"error": f"Error processing audio: {str(e)}"})



def read_words_from_csv(file_path):
    """
    Reads words from a CSV file. Assumes the CSV has a single column with words.
    """
    words_list = []
    try:
        with open(file_path, mode='r', newline='', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            for row in reader:
                if row:  # Avoid empty rows
                    words_list.append(row[0].strip().lower())  # Convert to lowercase for case-insensitive matching
    except FileNotFoundError:
        print("Error: The file was not found.")
    return words_list

def generate_suitable_sentence(sentence, words_list, abusive_words_list):
    """
    Generates a sentence by replacing words dynamically with contextually suitable or censored words.
    """
    words = sentence.split()
    processed_words = []

    for word in words:
        cleaned_word = re.sub(r'[^\w\s]', '', word).lower()  # Remove punctuation and convert to lowercase
        if cleaned_word in abusive_words_list:
            # Handle abusive word replacement with masking
            masked_sentence = sentence.replace(word, "[MASK]", 1)
            predictions = fill_mask(masked_sentence)
            best_replacement = predictions[0]["token_str"]  # Get the top prediction
            processed_word = word.replace(cleaned_word, best_replacement, 1)  # Replace abusive word
            processed_words.append(processed_word)
        elif cleaned_word in words_list:
            # Handle contextual replacement for words in the general list
            masked_sentence = sentence.replace(cleaned_word, "[MASK]", 1)
            predictions = fill_mask(masked_sentence)
            best_replacement = predictions[0]["token_str"]  # Get the top prediction
            processed_word = word.replace(cleaned_word, best_replacement, 1)
            processed_words.append(processed_word)
        else:
            processed_words.append(word)  # Keep the word as is if no replacement is required

    return ' '.join(processed_words)

# Load the words and abusive words from the CSV files
general_csv_path = "words.csv"  # Replace with your general words CSV file path
abusive_csv_path = "abusive_words.csv"  # Replace with your abusive words CSV file path
replacement_candidates = read_words_from_csv(general_csv_path)
abusive_words = read_words_from_csv(abusive_csv_path)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process():
    data = request.json
    user_sentence = data.get("sentence", "")
    if user_sentence and replacement_candidates:
        result_sentence = generate_suitable_sentence(user_sentence, replacement_candidates, abusive_words)
        return jsonify({"processed_sentence": result_sentence})
    return jsonify({"error": "Invalid input"}), 400

if __name__ == "__main__":
    app.run()