using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Displays score preview in 3D space, parented to UI camera.
    /// Shows preview of points being added during move selection.
    /// Score display and winner text now handled by EndGameScreen.
    /// </summary>
    public class ScoreDisplay : MonoBehaviour
    {
        public static ScoreDisplay Instance { get; private set; }

        [Header("Camera")]
        public Camera uiCamera;

        [Header("Layout")]
        public float marginFromSide = 1.5f;
        public float marginFromTop = 1.5f;

        [Header("Preview Settings")]
        public int previewFontSize = 8;
        public float baseTextScale = 0.1f;

        [Tooltip("Additional multiplier for landscape mode")]
        public float landscapeScaleBoost = 1.0f;

        [Tooltip("Side margin multiplier for landscape mode")]
        public float landscapeSideMarginMultiplier = 1.0f;

        // Preview display objects
        private Transform _displayAnchor;
        private TextMesh _yellowPreviewText;
        private TextMesh _bluePreviewText;

        // Calculated positions (for preview placement)
        private Vector3 _yellowPosition;
        private Vector3 _bluePosition;

        private float _handDistance = 6f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Find UI camera if not set
            if (uiCamera == null)
            {
                uiCamera = GetComponentInParent<Camera>();

                if (uiCamera == null)
                {
                    var uiCamObj = GameObject.Find("UICamera");
                    if (uiCamObj != null)
                    {
                        uiCamera = uiCamObj.GetComponent<Camera>();
                    }
                }

                if (uiCamera == null)
                {
                    Debug.LogError("ScoreDisplay: No UI camera found!");
                    return;
                }
            }

            // Create anchor as child of UI camera
            _displayAnchor = new GameObject("ScoreDisplayAnchor").transform;
            _displayAnchor.SetParent(uiCamera.transform);
            _displayAnchor.localPosition = Vector3.zero;
            _displayAnchor.localRotation = Quaternion.identity;

            CreatePreviewTexts();

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged += RefreshPreviews;
                GameManager.Instance.OnGameStateChanged += OnGameStateChanged;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            // Subscribe to UIScaler layout changes
            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged += RepositionPreviews;
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged -= RefreshPreviews;
                GameManager.Instance.OnGameStateChanged -= OnGameStateChanged;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }

            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged -= RepositionPreviews;
            }
        }

#if UNITY_EDITOR
        /// <summary>
        /// Called when inspector values change. Allows live tweaking in play mode.
        /// </summary>
        private void OnValidate()
        {
            if (!Application.isPlaying || _displayAnchor == null) return;
            RepositionPreviews();
        }
#endif

        /// <summary>
        /// Calculates the responsive scale including landscape boost.
        /// </summary>
        private float GetResponsiveScale()
        {
            if (UIScaler.Instance == null) return baseTextScale;

            float scale = baseTextScale * UIScaler.Instance.GetElementScale() * UIScaler.Instance.GetLandscapeElementScale();

            if (!UIScaler.Instance.IsPortrait)
            {
                scale *= landscapeScaleBoost;
            }

            return scale;
        }

        private void CreatePreviewTexts()
        {
            if (UIScaler.Instance == null) return;

            CalculatePositions();
            float responsiveScale = GetResponsiveScale();

            // Yellow preview (top left)
            _yellowPreviewText = CreateTextMesh("YellowPreview", _yellowPosition, previewFontSize, new Color(1f, 0.9f, 0.2f), responsiveScale);
            _yellowPreviewText.gameObject.SetActive(false);

            // Blue preview (top right)
            _bluePreviewText = CreateTextMesh("BluePreview", _bluePosition, previewFontSize, new Color(0.2f, 0.6f, 1f), responsiveScale);
            _bluePreviewText.gameObject.SetActive(false);
        }

        private void CalculatePositions()
        {
            if (UIScaler.Instance == null) return;

            float topOffset = UIScaler.Instance.GetTopEdge(marginFromTop);
            float effectiveMargin = UIScaler.Instance.IsPortrait ? marginFromSide : marginFromSide * landscapeSideMarginMultiplier;
            float sideOffset = UIScaler.Instance.HalfWidth - effectiveMargin;

            _yellowPosition = new Vector3(-sideOffset, topOffset, _handDistance);
            _bluePosition = new Vector3(sideOffset, topOffset, _handDistance);
        }

        private TextMesh CreateTextMesh(string name, Vector3 localPosition, int size, Color color, float scale)
        {
            GameObject textObj = new GameObject(name);
            textObj.transform.SetParent(_displayAnchor);
            textObj.transform.localPosition = localPosition;
            textObj.transform.localRotation = Quaternion.identity;

            // Set layer to UI3D so it's rendered by UI camera
            textObj.layer = LayerMask.NameToLayer("UI3D");

            // Scale based on responsive calculation
            textObj.transform.localScale = Vector3.one * scale;

            TextMesh textMesh = textObj.AddComponent<TextMesh>();
            textMesh.fontSize = 100;  // Large font size for crisp rendering
            textMesh.characterSize = size * 0.1f;  // Scale with the size parameter
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = color;
            textMesh.text = "";

            return textMesh;
        }

        private void RepositionPreviews()
        {
            if (UIScaler.Instance == null) return;

            CalculatePositions();
            float responsiveScale = GetResponsiveScale();

            _yellowPreviewText.transform.localPosition = _yellowPosition;
            _yellowPreviewText.transform.localScale = Vector3.one * responsiveScale;

            _bluePreviewText.transform.localPosition = _bluePosition;
            _bluePreviewText.transform.localScale = Vector3.one * responsiveScale;
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
            if (_yellowPreviewText != null)
                _yellowPreviewText.gameObject.SetActive(false);
            if (_bluePreviewText != null)
                _bluePreviewText.gameObject.SetActive(false);
        }

        /// <summary>
        /// Called when game state changes - hide preview after scoring.
        /// </summary>
        private void OnGameStateChanged()
        {
            // Hide preview when turn ends (scores updated)
            HidePreview();
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

                // Create simulation state for preview calculation (never mutate live state)
                var simState = state.Clone();
                simState.Tiles[pendingCastPosition.Value] = new Tile(
                    pendingLetter.Value,
                    currentPlayer,
                    pendingCastPosition.Value);

                var words = GameManager.Instance.WordScorer.FindWordsAt(
                    simState,
                    pendingCastPosition.Value,
                    pendingLetter.Value);

                int totalScore = 0;
                foreach (var word in words)
                {
                    int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, simState, currentPlayer);
                    totalScore += wordScore;
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

        private void OnGameRestarted()
        {
            HidePreview();
        }
    }
}