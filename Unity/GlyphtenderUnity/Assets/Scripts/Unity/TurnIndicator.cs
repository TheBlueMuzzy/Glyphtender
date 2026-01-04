/*******************************************************************************
 * TurnIndicator.cs
 *
 * PURPOSE:
 *   Displays contextual turn information in 3D UI space.
 *   Shows whose turn it is and what action is expected.
 *
 * RESPONSIBILITIES:
 *   - Show "Your turn" vs "Player X's turn" messages
 *   - Show action prompts: "Place a Glyphling", "Move your Glyphling", etc.
 *   - Handle online multiplayer context (local vs remote player)
 *   - Update dynamically based on game state changes
 *
 * ARCHITECTURE:
 *   - Singleton pattern
 *   - Parented to UI camera (same pattern as ScoreDisplay)
 *   - Subscribes to GameManager events for state changes
 *
 * USAGE:
 *   Automatically updates based on game state. No manual calls needed.
 ******************************************************************************/

using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Displays contextual turn indicator showing whose turn and what action.
    /// </summary>
    public class TurnIndicator : MonoBehaviour
    {
        public static TurnIndicator Instance { get; private set; }

        [Header("Camera")]
        public Camera uiCamera;

        [Header("Layout")]
        public float marginFromTop = 0.8f;
        public float textScale = 0.08f;

        [Header("Colors")]
        public Color yourTurnColor = new Color(0.4f, 1f, 0.4f);  // Green for your turn
        public Color waitingColor = new Color(0.7f, 0.7f, 0.75f);  // Gray for waiting
        public Color actionPromptColor = new Color(0.9f, 0.85f, 0.7f);  // Warm for action

        // UI elements
        private Transform _displayAnchor;
        private TextMesh _turnText;
        private TextMesh _actionText;

        private float _displayDistance = 6f;

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
                    Debug.LogError("TurnIndicator: No UI camera found!");
                    return;
                }
            }

            // Create anchor as child of UI camera
            _displayAnchor = new GameObject("TurnIndicatorAnchor").transform;
            _displayAnchor.SetParent(uiCamera.transform);
            _displayAnchor.localPosition = Vector3.zero;
            _displayAnchor.localRotation = Quaternion.identity;

            CreateTextElements();

            // Subscribe to game events
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += UpdateIndicator;
                GameManager.Instance.OnSelectionChanged += UpdateIndicator;
                GameManager.Instance.OnTurnStateChanged += OnTurnStateChanged;
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
                GameManager.Instance.OnDraftComplete += UpdateIndicator;
            }

            // Subscribe to UIScaler layout changes
            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged += RepositionElements;
            }

            UpdateIndicator();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= UpdateIndicator;
                GameManager.Instance.OnSelectionChanged -= UpdateIndicator;
                GameManager.Instance.OnTurnStateChanged -= OnTurnStateChanged;
                GameManager.Instance.OnGameEnded -= OnGameEnded;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
                GameManager.Instance.OnDraftComplete -= UpdateIndicator;
            }

            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged -= RepositionElements;
            }

            if (Instance == this)
            {
                Instance = null;
            }
        }

        private void CreateTextElements()
        {
            if (UIScaler.Instance == null) return;

            CalculatePositions(out Vector3 turnPos, out Vector3 actionPos);
            float responsiveScale = GetResponsiveScale();

            // Turn indicator (top center) - "Your turn" or "Waiting for Player 1"
            _turnText = CreateTextMesh("TurnText", turnPos, responsiveScale, waitingColor);

            // Action prompt (below turn indicator) - "Place a Glyphling", "Move your Glyphling", etc.
            _actionText = CreateTextMesh("ActionText", actionPos, responsiveScale * 0.7f, actionPromptColor);
        }

        private void CalculatePositions(out Vector3 turnPos, out Vector3 actionPos)
        {
            float topOffset = UIScaler.Instance != null
                ? UIScaler.Instance.GetTopEdge(marginFromTop)
                : 4f;

            turnPos = new Vector3(0f, topOffset, _displayDistance);
            actionPos = new Vector3(0f, topOffset - 0.6f, _displayDistance);
        }

        private float GetResponsiveScale()
        {
            if (UIScaler.Instance == null) return textScale;
            return textScale * UIScaler.Instance.GetElementScale() * UIScaler.Instance.GetLandscapeElementScale();
        }

        private TextMesh CreateTextMesh(string name, Vector3 localPosition, float scale, Color color)
        {
            GameObject textObj = new GameObject(name);
            textObj.transform.SetParent(_displayAnchor);
            textObj.transform.localPosition = localPosition;
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = Vector3.one * scale;
            textObj.layer = LayerMask.NameToLayer("UI3D");

            TextMesh textMesh = textObj.AddComponent<TextMesh>();
            textMesh.fontSize = 100;
            textMesh.characterSize = 0.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = color;
            textMesh.text = "";

            return textMesh;
        }

        private void RepositionElements()
        {
            if (_turnText == null || _actionText == null) return;

            CalculatePositions(out Vector3 turnPos, out Vector3 actionPos);
            float responsiveScale = GetResponsiveScale();

            _turnText.transform.localPosition = turnPos;
            _turnText.transform.localScale = Vector3.one * responsiveScale;

            _actionText.transform.localPosition = actionPos;
            _actionText.transform.localScale = Vector3.one * responsiveScale * 0.7f;
        }

        private void OnTurnStateChanged(GameTurnState state)
        {
            UpdateIndicator();
        }

        private void OnGameEnded(Player? winner)
        {
            // Hide turn indicator when game ends
            if (_turnText != null) _turnText.gameObject.SetActive(false);
            if (_actionText != null) _actionText.gameObject.SetActive(false);
        }

        private void OnGameRestarted()
        {
            if (_turnText != null) _turnText.gameObject.SetActive(true);
            if (_actionText != null) _actionText.gameObject.SetActive(true);
            UpdateIndicator();
        }

        /// <summary>
        /// Updates the turn indicator based on current game state.
        /// </summary>
        public void UpdateIndicator()
        {
            if (_turnText == null || _actionText == null) return;
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;
            var turnState = GameManager.Instance.CurrentTurnState;

            // Check if we're in online mode
            bool isOnline = NetworkedGameManager.Instance != null &&
                           NetworkedGameManager.Instance.IsOnlineGame;
            bool isLocalTurn = !isOnline || NetworkedGameManager.Instance.IsLocalPlayerTurn;

            // Determine whose turn it is
            Player activePlayer = state.Phase == GamePhase.Draft
                ? state.CurrentDrafter
                : state.CurrentPlayer;

            // Set turn text
            if (isOnline)
            {
                if (isLocalTurn)
                {
                    _turnText.text = "Your turn";
                    _turnText.color = yourTurnColor;
                }
                else
                {
                    string playerName = activePlayer == Player.Yellow ? "Player 1" : "Player 2";
                    _turnText.text = $"Waiting for {playerName}...";
                    _turnText.color = waitingColor;
                }
            }
            else
            {
                // Local game - show whose turn
                string playerName = GetPlayerName(activePlayer);
                _turnText.text = $"{playerName}'s turn";
                _turnText.color = GetPlayerColor(activePlayer);
            }

            // Set action text based on turn state
            if (isLocalTurn || !isOnline)
            {
                _actionText.text = GetActionPrompt(state, turnState);
                _actionText.color = actionPromptColor;
                _actionText.gameObject.SetActive(true);
            }
            else
            {
                // Not our turn in online mode - hide action prompt
                _actionText.gameObject.SetActive(false);
            }
        }

        private string GetActionPrompt(GameState state, GameTurnState turnState)
        {
            // Draft phase
            if (state.Phase == GamePhase.Draft)
            {
                if (GameManager.Instance.SelectedDraftGlyphling != null)
                {
                    if (GameManager.Instance.PendingDraftPosition != null)
                    {
                        return "Confirm placement";
                    }
                    return "Choose a hex to place";
                }
                return "Place a Glyphling";
            }

            // Play phase
            switch (turnState)
            {
                case GameTurnState.Idle:
                    return "Move one of your Glyphlings";

                case GameTurnState.GlyphlingSelected:
                    return "Choose where to move";

                case GameTurnState.MovePending:
                    return "Cast a Runeblossom";

                case GameTurnState.ReadyToConfirm:
                    return "Confirm your turn";

                case GameTurnState.CycleMode:
                    return "Discard any Runeblossoms";

                case GameTurnState.GameOver:
                    return "";

                default:
                    return "";
            }
        }

        private string GetPlayerName(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return "Yellow";
                case Player.Blue: return "Blue";
                case Player.Purple: return "Purple";
                case Player.Pink: return "Pink";
                default: return "Player";
            }
        }

        private Color GetPlayerColor(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return new Color(1f, 0.9f, 0.2f);
                case Player.Blue: return new Color(0.2f, 0.6f, 1f);
                case Player.Purple: return new Color(0.7f, 0.3f, 0.9f);
                case Player.Pink: return new Color(1f, 0.4f, 0.7f);
                default: return Color.white;
            }
        }

        /// <summary>
        /// Hides the turn indicator (e.g., when menu is open).
        /// </summary>
        public void Hide()
        {
            if (_displayAnchor != null)
            {
                _displayAnchor.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// Shows the turn indicator.
        /// </summary>
        public void Show()
        {
            if (_displayAnchor != null)
            {
                _displayAnchor.gameObject.SetActive(true);
            }
        }
    }
}
