using UnityEngine;
using UnityEngine.UI;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Controls all UI elements: hand display, scores, turn indicator, buttons.
    /// </summary>
    public class UIController : MonoBehaviour
    {
        [Header("Turn Info")]
        public Text turnText;
        public Text turnNumberText;

        [Header("Scores")]
        public Text yellowScoreText;
        public Text blueScoreText;

        [Header("Hand Display")]
        public Transform handContainer;
        public GameObject letterButtonPrefab;

        [Header("Action Buttons")]
        public Button confirmButton;
        public Button resetButton;

        [Header("Game Over")]
        public GameObject gameOverPanel;
        public Text winnerText;

        private List<GameObject> _letterButtons = new List<GameObject>();

        private void Start()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshUI;
                GameManager.Instance.OnSelectionChanged += RefreshSelection;
                GameManager.Instance.OnTurnEnded += RefreshUI;

                RefreshUI();
            }

            // Setup button listeners
            if (confirmButton != null)
            {
                confirmButton.onClick.AddListener(OnConfirmClicked);
            }
            if (resetButton != null)
            {
                resetButton.onClick.AddListener(OnResetClicked);
            }

            // Hide game over panel
            if (gameOverPanel != null)
            {
                gameOverPanel.SetActive(false);
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshUI;
                GameManager.Instance.OnSelectionChanged -= RefreshSelection;
                GameManager.Instance.OnTurnEnded -= RefreshUI;
            }
        }

        /// <summary>
        /// Refreshes all UI elements.
        /// </summary>
        public void RefreshUI()
        {
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;

            // Turn info
            if (turnText != null)
            {
                turnText.text = $"{state.CurrentPlayer}'s Turn";
                turnText.color = state.CurrentPlayer == Player.Yellow
                    ? Color.yellow
                    : Color.blue;
            }

            if (turnNumberText != null)
            {
                turnNumberText.text = $"Turn {state.TurnNumber}";
            }

            // Scores
            if (yellowScoreText != null)
            {
                yellowScoreText.text = $"Yellow: {state.Scores[Player.Yellow]}";
            }

            if (blueScoreText != null)
            {
                blueScoreText.text = $"Blue: {state.Scores[Player.Blue]}";
            }

            // Hand
            RefreshHand();

            // Game over
            if (state.IsGameOver && gameOverPanel != null)
            {
                gameOverPanel.SetActive(true);
                if (winnerText != null)
                {
                    var yellowScore = state.Scores[Player.Yellow];
                    var blueScore = state.Scores[Player.Blue];

                    if (yellowScore > blueScore)
                        winnerText.text = "Yellow Wins!";
                    else if (blueScore > yellowScore)
                        winnerText.text = "Blue Wins!";
                    else
                        winnerText.text = "It's a Tie!";
                }
            }

            RefreshSelection();
        }

        /// <summary>
        /// Refreshes the hand display for current player.
        /// </summary>
        private void RefreshHand()
        {
            // Clear existing buttons
            foreach (var btn in _letterButtons)
            {
                Destroy(btn);
            }
            _letterButtons.Clear();

            if (GameManager.Instance?.GameState == null) return;
            if (handContainer == null) return;

            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];

            foreach (var letter in hand)
            {
                CreateLetterButton(letter);
            }
        }

        private void CreateLetterButton(char letter)
        {
            GameObject btnObj;

            if (letterButtonPrefab != null)
            {
                btnObj = Instantiate(letterButtonPrefab, handContainer);
            }
            else
            {
                // Create simple button if no prefab
                btnObj = new GameObject($"Letter_{letter}");
                btnObj.transform.SetParent(handContainer);

                var image = btnObj.AddComponent<Image>();
                image.color = Color.white;

                var button = btnObj.AddComponent<Button>();

                // Add text child
                var textObj = new GameObject("Text");
                textObj.transform.SetParent(btnObj.transform);
                var text = textObj.AddComponent<Text>();
                text.text = letter.ToString();
                text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                text.fontSize = 24;
                text.alignment = TextAnchor.MiddleCenter;
                text.color = Color.black;

                var rectTransform = btnObj.GetComponent<RectTransform>();
                if (rectTransform != null)
                {
                    rectTransform.sizeDelta = new Vector2(50, 50);
                }

                var textRect = textObj.GetComponent<RectTransform>();
                if (textRect != null)
                {
                    textRect.anchorMin = Vector2.zero;
                    textRect.anchorMax = Vector2.one;
                    textRect.sizeDelta = Vector2.zero;
                    textRect.anchoredPosition = Vector2.zero;
                }
            }

            // Setup click handler
            var btn = btnObj.GetComponent<Button>();
            if (btn != null)
            {
                char capturedLetter = letter;
                btn.onClick.AddListener(() => OnLetterClicked(capturedLetter));
            }

            // Set letter text if using prefab
            var letterText = btnObj.GetComponentInChildren<Text>();
            if (letterText != null)
            {
                letterText.text = letter.ToString();

                // Show point value
                int points = WordScorer.GetLetterValue(letter);
                // Could add subscript for points
            }

            _letterButtons.Add(btnObj);
        }

        /// <summary>
        /// Updates button states based on current selection.
        /// </summary>
        private void RefreshSelection()
        {
            if (GameManager.Instance == null) return;

            bool canConfirm = GameManager.Instance.SelectedGlyphling != null &&
                             GameManager.Instance.PendingDestination != null &&
                             GameManager.Instance.PendingCastPosition != null &&
                             GameManager.Instance.PendingLetter != null;

            bool canReset = GameManager.Instance.SelectedGlyphling != null;

            if (confirmButton != null)
            {
                confirmButton.interactable = canConfirm;
            }

            if (resetButton != null)
            {
                resetButton.interactable = canReset;
            }

            // Highlight selected letter in hand
            HighlightSelectedLetter();
        }

        private void HighlightSelectedLetter()
        {
            var selectedLetter = GameManager.Instance?.PendingLetter;

            foreach (var btnObj in _letterButtons)
            {
                var image = btnObj.GetComponent<Image>();
                var text = btnObj.GetComponentInChildren<Text>();

                if (image != null && text != null)
                {
                    bool isSelected = selectedLetter.HasValue &&
                                     text.text == selectedLetter.Value.ToString();

                    image.color = isSelected ? Color.green : Color.white;
                }
            }
        }

        private void OnLetterClicked(char letter)
        {
            Debug.Log($"Letter clicked: {letter}");
            GameManager.Instance?.SelectLetter(letter);
        }

        private void OnConfirmClicked()
        {
            Debug.Log("Confirm clicked");
            GameManager.Instance?.ConfirmMove();
        }

        private void OnResetClicked()
        {
            Debug.Log("Reset clicked");
            GameManager.Instance?.ResetMove();
        }
    }
}