using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Displays player scores in 3D space, parented to camera.
    /// Yellow score in top left, Blue score in top right.
    /// Shows preview of points being added below the score.
    /// </summary>
    public class ScoreDisplay : MonoBehaviour
    {
        [Header("Layout")]
        public Vector3 yellowScorePosition = new Vector3(-4f, 3f, 6f);
        public Vector3 blueScorePosition = new Vector3(4f, 3f, 6f);

        [Header("Text Settings")]
        public int fontSize = 48;
        public int previewFontSize = 32;

        // Score display objects
        private Transform _displayAnchor;
        private TextMesh _yellowScoreText;
        private TextMesh _blueScoreText;
        private TextMesh _yellowPreviewText;
        private TextMesh _bluePreviewText;
        private TextMesh _yellowWinnerText;
        private TextMesh _blueWinnerText;

        private void Start()
        {
            // Create anchor as child of camera
            _displayAnchor = new GameObject("ScoreDisplayAnchor").transform;
            _displayAnchor.SetParent(Camera.main.transform);
            _displayAnchor.localPosition = Vector3.zero;
            _displayAnchor.localRotation = Quaternion.identity;

            CreateScoreTexts();

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshScores;
                GameManager.Instance.OnSelectionChanged += RefreshPreviews;
                GameManager.Instance.OnGameEnded += ShowWinner;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
                RefreshScores();
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshScores;
                GameManager.Instance.OnSelectionChanged -= RefreshPreviews;
                GameManager.Instance.OnGameEnded -= ShowWinner;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }
        }

        private void CreateScoreTexts()
        {
            // Yellow score (top left)
            _yellowScoreText = CreateTextMesh("YellowScore", yellowScorePosition, fontSize, new Color(1f, 0.9f, 0.2f));

            // Yellow preview (below yellow score)
            Vector3 yellowPreviewPos = yellowScorePosition + new Vector3(0f, -0.6f, 0f);
            _yellowPreviewText = CreateTextMesh("YellowPreview", yellowPreviewPos, previewFontSize, new Color(1f, 0.9f, 0.2f));
            _yellowPreviewText.gameObject.SetActive(false);

            // Blue score (top right)
            _blueScoreText = CreateTextMesh("BlueScore", blueScorePosition, fontSize, new Color(0.2f, 0.6f, 1f));

            // Blue preview (below blue score)
            Vector3 bluePreviewPos = blueScorePosition + new Vector3(0f, -0.6f, 0f);
            _bluePreviewText = CreateTextMesh("BluePreview", bluePreviewPos, previewFontSize, new Color(0.2f, 0.6f, 1f));
            _bluePreviewText.gameObject.SetActive(false);
        }

        private TextMesh CreateTextMesh(string name, Vector3 localPosition, int size, Color color)
        {
            GameObject textObj = new GameObject(name);
            textObj.transform.SetParent(_displayAnchor);
            textObj.transform.localPosition = localPosition;
            textObj.transform.localRotation = Quaternion.identity;

            // Scale down but use large font size for crisp text
            textObj.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f);

            TextMesh textMesh = textObj.AddComponent<TextMesh>();
            textMesh.fontSize = 100;  // Large font size for crisp rendering
            textMesh.characterSize = size * 0.1f;  // Scale with the size parameter
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = color;
            textMesh.text = "0";

            return textMesh;
        }

        /// <summary>
        /// Updates the score displays from game state.
        /// </summary>
        public void RefreshScores()
        {
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;

            _yellowScoreText.text = state.Scores[Player.Yellow].ToString();
            _blueScoreText.text = state.Scores[Player.Blue].ToString();

            // Hide previews when scores update (turn ended)
            HidePreview();
        }

        /// <summary>
        /// Shows or updates the score preview for current player.
        /// </summary>
        public void ShowPreview(int pointsToAdd)
        {
            if (GameManager.Instance?.GameState == null) return;

            var currentPlayer = GameManager.Instance.GameState.CurrentPlayer;

            if (currentPlayer == Player.Yellow)
            {
                _yellowPreviewText.text = $"+{pointsToAdd}";
                _yellowPreviewText.gameObject.SetActive(true);
            }
            else
            {
                _bluePreviewText.text = $"+{pointsToAdd}";
                _bluePreviewText.gameObject.SetActive(true);
            }
        }

        /// <summary>
        /// Hides the score preview.
        /// </summary>
        public void HidePreview()
        {
            _yellowPreviewText.gameObject.SetActive(false);
            _bluePreviewText.gameObject.SetActive(false);
        }

        /// <summary>
        /// Called when selection changes - update preview based on pending letter.
        /// </summary>
        private void RefreshPreviews()
        {
            if (GameManager.Instance?.GameState == null) return;

            var pendingLetter = GameManager.Instance.PendingLetter;
            var pendingCastPosition = GameManager.Instance.PendingCastPosition;

            // Only show preview if we have both a cast position and letter selected
            if (pendingLetter != null && pendingCastPosition != null)
            {
                var state = GameManager.Instance.GameState;
                var currentPlayer = state.CurrentPlayer;

                // Temporarily add the tile for scoring calculation
                bool hadTile = state.Tiles.ContainsKey(pendingCastPosition.Value);
                Tile oldTile = hadTile ? state.Tiles[pendingCastPosition.Value] : null;
                state.Tiles[pendingCastPosition.Value] = new Tile(
                    pendingLetter.Value,
                    currentPlayer,
                    pendingCastPosition.Value);

                var words = GameManager.Instance.WordScorer.FindWordsAt(
                    state,
                    pendingCastPosition.Value,
                    pendingLetter.Value);

                int totalScore = 0;
                foreach (var word in words)
                {
                    int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, state, currentPlayer);
                    totalScore += wordScore;
                }

                // Restore original state
                if (hadTile)
                {
                    state.Tiles[pendingCastPosition.Value] = oldTile;
                }
                else
                {
                    state.Tiles.Remove(pendingCastPosition.Value);
                }

                if (totalScore > 0)
                {
                    ShowPreview(totalScore);
                }
                else
                {
                    HidePreview();
                }
            }
            else
            {
                HidePreview();
            }
        }

        /// <summary>
        /// Shows the winner display when game ends.
        /// </summary>
        private void ShowWinner(Player? winner)
        {
            // Hide previews
            HidePreview();

            if (winner == Player.Yellow)
            {
                // Enlarge yellow score
                _yellowScoreText.transform.localScale *= 1.5f;

                // Add winner text below
                _yellowWinnerText = CreateTextMesh("YellowWinner",
                    yellowScorePosition + new Vector3(0f, -1f, 0f),
                    previewFontSize,
                    new Color(1f, 0.9f, 0.2f));
                _yellowWinnerText.text = "WINNER";
            }
            else if (winner == Player.Blue)
            {
                // Enlarge blue score
                _blueScoreText.transform.localScale *= 1.5f;

                // Add winner text below
                _blueWinnerText = CreateTextMesh("BlueWinner",
                    blueScorePosition + new Vector3(0f, -1f, 0f),
                    previewFontSize,
                    new Color(0.2f, 0.6f, 1f));
                _blueWinnerText.text = "WINNER";
            }
            else
            {
                // Tie - show both
                _yellowWinnerText = CreateTextMesh("YellowTie",
                    yellowScorePosition + new Vector3(0f, -1f, 0f),
                    previewFontSize,
                    new Color(1f, 0.9f, 0.2f));
                _yellowWinnerText.text = "TIE";

                _blueWinnerText = CreateTextMesh("BlueTie",
                    blueScorePosition + new Vector3(0f, -1f, 0f),
                    previewFontSize,
                    new Color(0.2f, 0.6f, 1f));
                _blueWinnerText.text = "TIE";
            }
        }
        private void OnGameRestarted()
        {
            // Reset score text scale
            _yellowScoreText.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f);
            _blueScoreText.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f);

            // Remove winner texts if they exist
            if (_yellowWinnerText != null)
            {
                Destroy(_yellowWinnerText.gameObject);
                _yellowWinnerText = null;
            }
            if (_blueWinnerText != null)
            {
                Destroy(_blueWinnerText.gameObject);
                _blueWinnerText = null;
            }

            // Refresh scores to show 0
            RefreshScores();
        }
    }
}