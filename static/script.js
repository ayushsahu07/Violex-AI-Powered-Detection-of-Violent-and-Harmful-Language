let senBtn = document.querySelector("#filter-icon");
let curr = true;
let micBtn = document.querySelector("#mic");
let clsBtn = document.querySelector("#close-popup");
let audio = new Audio('static/Skype_call_sound.mp3');

// Popup and Button Functionality
const mediaQuery = window.matchMedia('(max-width: 768px)');

senBtn.addEventListener("click", function () {
    if (true) {
        document.getElementById("card-cont").style.display = "flex";
        document.getElementById("hero-f").style.display = "none";
    }
});
// Function to handle pressing the Enter key to trigger the send button logic
document.querySelector(".search-input").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent the default "Enter" behavior (like form submission)

        // Trigger the send button logic manually
        document.getElementById("filter-icon").click();
    }
});


micBtn.addEventListener("click", function () {
    if (curr) {
        document.getElementById("popup").style.display = "flex";
        audio.volume = 0.01;
        audio.play();
        curr = false;
    }
});

const popup = document.getElementById("popup");

// Close the popup when clicking the close button
clsBtn.addEventListener("click", function () {
    popup.style.display = "none";
    if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
    }
    curr = true;
});

// Close the popup when clicking anywhere outside the content
window.addEventListener("click", (event) => {
    if (popup.style.display === "block" && !popup.contains(event.target)) {
        popup.style.display = "none";
        if (audio && !audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
        curr = true;
    }
});

// Backend-Flask Logic
document.getElementById("filter-icon").addEventListener("click", async () => {
    const inputField = document.querySelector(".search-input");
    const chatContainer = document.querySelector(".chat-container");
    const sentence = inputField.value.trim();

    if (!sentence) {
        alert("Please enter a sentence.");
        return;
    }

    try {
        // Send the input to the Flask backend
        const response = await fetch("/process", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sentence: sentence }),
        });

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        const result = await response.json();

        // Validate the backend response
        if (result.processed_sentence) {
            // Add user input as a "right" message
            createMessage(sentence, "right");

            // Add backend response as a "left" message after 1 second
            setTimeout(() => {
                createMessage(result.processed_sentence, "left", sentence);
            }, 1000);
        } else {
            alert(result.error || "Error processing the sentence.");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while processing.");
    }
});

// Helper function to create and append messages
function createMessage(content, type, userContent = '') {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", type); // "left" or "right"

    const profilePic = document.createElement("img");
    profilePic.classList.add("profile-pic");
    profilePic.src = type === "right" ? "static/john.jpg" : "static/Robo.jpg"; // Avatar for message type
    messageDiv.appendChild(profilePic);

    const bubbleDiv = document.createElement("div");
    bubbleDiv.classList.add("bubble");

    // Add the bubble to the messageDiv immediately without text
    messageDiv.appendChild(bubbleDiv);
    const chatContainer = document.querySelector(".chat-container");
    chatContainer.appendChild(messageDiv); // Add the message to the container

    // Check if the message is for the left bubble
    if (type === "left") {
        // Create loader container and dots
        const loader = document.createElement("section");
        loader.className = "dots-container";

        for (let i = 0; i < 5; i++) {
            const dot = document.createElement("div");
            dot.className = "dot";
            loader.appendChild(dot);
        }

        // Add loader to the bubbleDiv temporarily
        bubbleDiv.appendChild(loader);

        // Display the message after 3 seconds
        setTimeout(() => {
            bubbleDiv.removeChild(loader); // Remove loader
            // Compare the sentences and highlight differences
            if (userContent) {
                bubbleDiv.innerHTML = highlightDifferences(userContent, content);
            } else {
                bubbleDiv.textContent = content; // No change, just show the content
            }
        }, 3000); // 3000 milliseconds = 3 seconds
    } else {
        // For right messages, set content immediately
        bubbleDiv.textContent = content;
    }
}

// Function to highlight differences in bold with red color
function highlightDifferences(original, newContent) {
    let originalWords = original.split(" ");
    let newWords = newContent.split(" ");
    let highlightedContent = "";

    for (let i = 0; i < newWords.length; i++) {
        // Compare each word and check if there's a difference
        if (originalWords[i] !== newWords[i]) {
            highlightedContent += `<b style="color: red;">${newWords[i]}</b> `;
        } else {
            highlightedContent += `${newWords[i]} `;
        }
    }

    return highlightedContent.trim();
}







let mediaRecorder;
let audioChunks = [];
let isRecording = false;  // Flag to track recording status
let audioStream;  // Store the media stream to stop it if needed

document.getElementById('mic').addEventListener('click', () => {
    // Prevent multiple recordings
    if (isRecording) return;
    isRecording = true;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        audioStream = stream;  // Store the stream
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.start();

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav');

            // Send audio to the Flask server
            fetch('/upload', {
                method: 'POST',
                body: formData,
            })
                .then(response => response.json())
                .then(data => {
                    if (data.text) {
                        console.log("Recognized Text:", data.text);
                        document.querySelector('.search-input').value = data.text;
                    } else {
                        console.error(data.error);
                    }
                })
                .catch(err => console.error(err));

            isRecording = false;  // Reset the recording flag after processing
        };

        // Automatically stop the recording after 5 seconds
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                console.log("Recording stopped after 5 seconds.");
            }
        }, 5000);
    }).catch((err) => {
        console.error("Microphone access error:", err);
        isRecording = false;  // Reset in case of error
    });
});

// Close the popup and stop recording when clicking the close button
clsBtn.addEventListener("click", function () {
    popup.style.display = "none";  // Hide the popup

    // Stop the recording if it is in progress
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log("Recording stopped when popup was closed.");
    }

    // Stop the stream to release resources
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        console.log("Stream stopped.");
    }

    isRecording = false;  // Reset the recording flag
    curr = true;
});
