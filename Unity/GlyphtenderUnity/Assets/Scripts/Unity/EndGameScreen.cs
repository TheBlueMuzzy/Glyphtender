using UnityEngine;
using UnityEngine.Rendering;
using System.Collections.Generic;
using Glyphtender.Core;
using Glyphtender.Core.Stats;
using Glyphtender.Unity.Stats;
using Glyphtender.Unity.Network;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Displays game-end stats screen with per-game statistics for both players.
    /// Uses 3D UI pattern matching MenuController.
    /// </summary>
    public class EndGameScreen : MonoBehaviour
    {
        public static EndGameScreen Instance { get; private set; }

        [Header("References")]
        public Camera uiCamera;

        [Header("Appearance")]
        public Material panelMaterial;
        public Material buttonMaterial;
        public float panelWidth = 7.0f;
        public float panelHeight = 9.0f;
        public float menuZ = 5f;

        [Header("Colors")]
        public Color yellowColor = new Color(1f, 0.85f, 0.4f);
        public Color blueColor = new Color(0.4f, 0.7f, 1f);
        public Color purpleColor = new Color(0.7f, 0.4f, 1f);
        public Color pinkColor = new Color(1f, 0.6f, 0.8f);
        public Color winnerColor = new Color(1f, 0.95f, 0.6f);
        public Color statLabelColor = new Color(0.7f, 0.7f, 0.75f);
        public Color statValueColor = Color.white;

        [Header("Animation")]
        public float openDuration = 0.2f;
        public float closeDuration = 0.15f;

        // Screen state
        private bool _isVisible;
        private bool _statsPanelVisible;
        private GameObject _screenRoot;
        private GameObject _statsPanel;
        private GameObject _backgroundBlocker;
        private GameObject _buttonsContainer;
        private List<GameObject> _screenItems = new List<GameObject>();

        // Button references for text swapping
        private TextMesh _viewButtonText;

        // Rematch UI
        private GameObject _rematchButton;
        private TextMesh _rematchButtonText;
        private Renderer _rematchButtonRenderer;
        private GameObject _declineButton;
        private GameObject _timerDisplay;
        private TextMesh _timerText;
        private bool _localPlayerConfirmed;
        private Dictionary<Player, TextMesh> _playerStatusIndicators = new Dictionary<Player, TextMesh>();

        // Rematch colors
        private Color _confirmedColor = new Color(0.3f, 0.8f, 0.3f);  // Green
        private Color _pendingColor = new Color(0.3f, 0.3f, 0.35f);   // Gray (matches button)

        // Animation
        private bool _isAnimating;
        private float _animationTime;
        private Vector3 _animationStartScale;
        private Vector3 _animationEndScale;

        // Cached stats
        private GameStats _displayedStats;

        public bool IsVisible => _isVisible;

        private void Awake()
        {
            Instance = this;
        }

        private void Start()
        {
            if (uiCamera == null)
            {
                var camObj = GameObject.Find("UICamera");
                if (camObj != null) uiCamera = camObj.GetComponent<Camera>();
            }

            // Subscribe to game end event
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            // Subscribe to rematch events
            SubscribeToRematchEvents();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameEnded -= OnGameEnded;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }

            UnsubscribeFromRematchEvents();
        }

        private void Update()
        {
            if (_isAnimating)
            {
                _animationTime += Time.deltaTime;
                float duration = _animationEndScale == Vector3.zero ? closeDuration : openDuration;
                float t = Mathf.Clamp01(_animationTime / duration);
                float eased = 1f - Mathf.Pow(1f - t, 3f);

                _statsPanel.transform.localScale = Vector3.Lerp(_animationStartScale, _animationEndScale, eased);

                if (t >= 1f)
                {
                    _isAnimating = false;
                    if (_animationEndScale == Vector3.zero)
                    {
                        _statsPanel.SetActive(false);
                    }
                }
            }

            // Update rematch timer display
            if (_isVisible && RematchManager.Instance != null && RematchManager.Instance.IsTimerActive)
            {
                float remaining = RematchManager.Instance.GetTimeRemaining();
                int seconds = Mathf.CeilToInt(remaining);

                // Update timer text
                if (_timerText != null)
                {
                    _timerText.text = $"Waiting... {seconds}s";
                }

                // Update rematch button text if local player confirmed
                if (_localPlayerConfirmed && _rematchButtonText != null)
                {
                    _rematchButtonText.text = $"Rematch! {seconds}s";
                }

                // Show timer display if not visible
                if (_timerDisplay != null && !_timerDisplay.activeSelf)
                {
                    _timerDisplay.SetActive(true);
                }
            }

            // Handle clicks when visible
            if (_isVisible && !_isAnimating && Input.GetMouseButtonDown(0))
            {
                HandleClick();
            }
        }

        private void HandleClick()
        {
            // Clicks on background do nothing (don't close end screen)
        }

        private void OnGameEnded(Player? winner)
        {
            // Get stats from GameHistoryManager
            _displayedStats = GameHistoryManager.Instance?.LastGameStats;
            Show(winner);
        }

        private void OnGameRestarted()
        {
            Hide();
        }

        /// <summary>
        /// Shows the end game screen with stats.
        /// </summary>
        public void Show(Player? winner)
        {
            if (_isVisible) return;

            _isVisible = true;
            _statsPanelVisible = true;

            // Destroy old screen if exists
            if (_screenRoot != null)
            {
                Destroy(_screenRoot);
            }

            // Initialize rematch state
            int playerCount = _displayedStats?.PlayerCount ?? 2;
            RematchManager.Instance?.Initialize(playerCount);
            _localPlayerConfirmed = false;
            _playerStatusIndicators.Clear();

            CreateScreen(winner);

            // Hide hand
            HandController.Instance?.HideHand();

            // Animate in
            _statsPanel.SetActive(true);
            _animationStartScale = Vector3.zero;
            _animationEndScale = Vector3.one;
            _statsPanel.transform.localScale = _animationStartScale;
            _animationTime = 0f;
            _isAnimating = true;
        }

        /// <summary>
        /// Hides the entire end game screen.
        /// </summary>
        public void Hide()
        {
            if (!_isVisible) return;

            _isVisible = false;
            _statsPanelVisible = false;

            if (_screenRoot != null)
            {
                Destroy(_screenRoot);
                _screenRoot = null;
                _statsPanel = null;
                _buttonsContainer = null;
                _backgroundBlocker = null;
                _viewButtonText = null;
                _rematchButton = null;
                _rematchButtonText = null;
                _rematchButtonRenderer = null;
                _declineButton = null;
                _timerDisplay = null;
                _timerText = null;
            }

            _screenItems.Clear();
            _playerStatusIndicators.Clear();

            // Show hand
            HandController.Instance?.ShowHand();
        }

        /// <summary>
        /// Toggles between showing stats panel and viewing the board.
        /// Buttons remain visible in both states.
        /// </summary>
        public void ToggleStatsPanel()
        {
            if (_statsPanelVisible)
            {
                // Hide stats to show board
                _statsPanelVisible = false;
                _animationStartScale = Vector3.one;
                _animationEndScale = Vector3.zero;
                _animationTime = 0f;
                _isAnimating = true;

                // Hide background blocker to show board
                if (_backgroundBlocker != null)
                {
                    _backgroundBlocker.SetActive(false);
                }

                // Change button text
                if (_viewButtonText != null)
                {
                    _viewButtonText.text = "View Stats";
                }
            }
            else
            {
                // Show stats
                _statsPanelVisible = true;
                _statsPanel.SetActive(true);
                _animationStartScale = Vector3.zero;
                _animationEndScale = Vector3.one;
                _statsPanel.transform.localScale = _animationStartScale;
                _animationTime = 0f;
                _isAnimating = true;

                // Show background blocker
                if (_backgroundBlocker != null)
                {
                    _backgroundBlocker.SetActive(true);
                }

                // Change button text
                if (_viewButtonText != null)
                {
                    _viewButtonText.text = "View Board";
                }
            }
        }

        private void CreateScreen(Player? winner)
        {
            _screenRoot = new GameObject("EndGameScreen");
            _screenRoot.transform.SetParent(uiCamera.transform);
            _screenRoot.transform.localPosition = new Vector3(0f, 0f, menuZ);
            _screenRoot.transform.localRotation = Quaternion.identity;
            _screenRoot.layer = LayerMask.NameToLayer("UI3D");

            CreateBackgroundBlocker();
            CreateStatsPanel(winner);
            CreateButtons();
        }

        private void CreateBackgroundBlocker()
        {
            _backgroundBlocker = GameObject.CreatePrimitive(PrimitiveType.Quad);
            _backgroundBlocker.name = "BackgroundBlocker";
            _backgroundBlocker.transform.SetParent(_screenRoot.transform);
            _backgroundBlocker.transform.localPosition = new Vector3(0f, 0f, 0.5f);
            _backgroundBlocker.transform.localRotation = Quaternion.identity;
            _backgroundBlocker.transform.localScale = new Vector3(50f, 50f, 1f);
            _backgroundBlocker.layer = LayerMask.NameToLayer("UI3D");

            var renderer = _backgroundBlocker.GetComponent<Renderer>();
            Material invisMat = new Material(Shader.Find("Standard"));
            invisMat.color = new Color(0, 0, 0, 0.3f); // Slight dim
            invisMat.SetFloat("_Mode", 3);
            invisMat.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            invisMat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            invisMat.SetInt("_ZWrite", 0);
            invisMat.DisableKeyword("_ALPHATEST_ON");
            invisMat.EnableKeyword("_ALPHABLEND_ON");
            invisMat.renderQueue = 3000;
            renderer.material = invisMat;
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Consume clicks but don't close
            var handler = _backgroundBlocker.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => { };
        }

        private void CreateStatsPanel(Player? winner)
        {
            _statsPanel = new GameObject("StatsPanel");
            _statsPanel.transform.SetParent(_screenRoot.transform);
            _statsPanel.transform.localPosition = Vector3.zero;
            _statsPanel.transform.localRotation = Quaternion.identity;
            _statsPanel.layer = LayerMask.NameToLayer("UI3D");

            // Determine player count from stats or default to 2
            int playerCount = _displayedStats?.PlayerCount ?? 2;
            if (playerCount < 2) playerCount = 2;
            if (playerCount > 4) playerCount = 4;

            // Get active players in order
            Player[] activePlayers = GetActivePlayersArray(playerCount);

            // Adjust panel width based on player count
            float adjustedPanelWidth = panelWidth * GetPanelWidthMultiplier(playerCount);

            // Panel background
            GameObject panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = "PanelBackground";
            panel.transform.SetParent(_statsPanel.transform);
            panel.transform.localPosition = Vector3.zero;
            panel.transform.localRotation = Quaternion.identity;
            panel.transform.localScale = new Vector3(adjustedPanelWidth, panelHeight, 0.05f);
            panel.layer = LayerMask.NameToLayer("UI3D");

            var renderer = panel.GetComponent<Renderer>();
            if (panelMaterial != null)
                renderer.material = panelMaterial;
            else
                renderer.material.color = new Color(0.12f, 0.12f, 0.15f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Consume clicks on panel
            var panelHandler = panel.AddComponent<MenuButtonClickHandler>();
            panelHandler.OnClick = () => { };

            float elementScale = panelHeight / 5.0f;
            float contentTop = (panelHeight / 2f) - (0.5f * elementScale);

            // Winner banner
            float yPos = contentTop;
            CreateWinnerBanner(winner, yPos, elementScale);
            yPos -= 0.7f * elementScale;

            // Column headers
            CreateColumnHeaders(yPos, elementScale, playerCount, activePlayers);
            yPos -= 0.5f * elementScale;

            // Get stats for each active player
            var playerStats = new PlayerGameStats[playerCount];
            for (int i = 0; i < playerCount; i++)
            {
                playerStats[i] = _displayedStats?.GetStatsForPlayer(activePlayers[i]);
            }

            // Helper to build stat values array
            string[] BuildStatValues(System.Func<PlayerGameStats, string> getter)
            {
                var values = new string[playerCount];
                for (int i = 0; i < playerCount; i++)
                {
                    values[i] = playerStats[i] != null ? getter(playerStats[i]) : "-";
                }
                return values;
            }

            // 1. Final Score
            CreateStatRow("Final Score",
                BuildStatValues(s => s.FinalScore.ToString()),
                activePlayers, yPos, elementScale, playerCount);
            yPos -= 0.4f * elementScale;

            // 2. Tangle Points
            CreateStatRow("Tangle Pts",
                BuildStatValues(s => s.TanglePoints.ToString()),
                activePlayers, yPos, elementScale, playerCount);
            yPos -= 0.4f * elementScale;

            // 3. Points/Turn
            CreateStatRow("Points/Turn",
                BuildStatValues(s => s.PointsPerTurn.ToString("F1")),
                activePlayers, yPos, elementScale, playerCount);
            yPos -= 0.4f * elementScale;

            // 4. Best Turn
            CreateStatRow("Best Turn",
                BuildStatValues(s => s.BestScoringTurn.ToString()),
                activePlayers, yPos, elementScale, playerCount);
            yPos -= 0.4f * elementScale;

            // 5. Longest Word
            CreateStatRow("Longest Word",
                BuildStatValues(s => s.LongestWord ?? "-"),
                activePlayers, yPos, elementScale, playerCount);
            yPos -= 0.4f * elementScale;

            // 6. Multi-Words
            CreateStatRow("Multi-Words",
                BuildStatValues(s => s.MultiWordPlays.ToString()),
                activePlayers, yPos, elementScale, playerCount);
            yPos -= 0.4f * elementScale;

            // 7. Unique Words
            CreateStatRow("Unique Words",
                BuildStatValues(s => s.UniqueWordsScored.ToString()),
                activePlayers, yPos, elementScale, playerCount);
        }

        /// <summary>
        /// Returns an array of active players in turn order.
        /// </summary>
        private Player[] GetActivePlayersArray(int playerCount)
        {
            var players = new Player[playerCount];
            players[0] = Player.Yellow;
            if (playerCount > 1) players[1] = Player.Blue;
            if (playerCount > 2) players[2] = Player.Purple;
            if (playerCount > 3) players[3] = Player.Pink;
            return players;
        }

        private void CreateButtons()
        {
            _buttonsContainer = new GameObject("ButtonsContainer");
            _buttonsContainer.transform.SetParent(_screenRoot.transform);
            _buttonsContainer.transform.localPosition = Vector3.zero;
            _buttonsContainer.transform.localRotation = Quaternion.identity;
            _buttonsContainer.layer = LayerMask.NameToLayer("UI3D");

            float elementScale = panelHeight / 5.0f;
            float buttonY = -(panelHeight / 2f) + (0.5f * elementScale);

            // Check if this is an online game
            bool isOnlineGame = NetworkedGameManager.Instance != null && NetworkedGameManager.Instance.IsOnlineGame;

            if (isOnlineGame)
            {
                // Create rematch flow buttons for online games

                // Timer display (above buttons, hidden initially)
                CreateTimerDisplay(buttonY + 0.5f * elementScale, elementScale);

                // Rematch button (left)
                CreateRematchButton(-0.9f * elementScale, buttonY, elementScale);

                // Decline button (center-left, smaller)
                CreateDeclineButton(0f, buttonY, elementScale);

                // View Board / View Stats button (right)
                _viewButtonText = CreateButton(_buttonsContainer, "View Board", 0.9f * elementScale, buttonY, elementScale, () => {
                    ToggleStatsPanel();
                });
            }
            else
            {
                // Local game - use simple Play Again button
                CreateButton(_buttonsContainer, "Play Again", -0.9f * elementScale, buttonY, elementScale, () => {
                    Hide();
                    GameManager.Instance?.InitializeGame();
                });

                // View Board / View Stats button (right)
                _viewButtonText = CreateButton(_buttonsContainer, "View Board", 0.9f * elementScale, buttonY, elementScale, () => {
                    ToggleStatsPanel();
                });
            }
        }

        private void CreateTimerDisplay(float y, float scale)
        {
            _timerDisplay = new GameObject("TimerDisplay");
            _timerDisplay.transform.SetParent(_buttonsContainer.transform);
            _timerDisplay.transform.localPosition = new Vector3(0f, y, -0.1f);
            _timerDisplay.transform.localRotation = Quaternion.identity;
            _timerDisplay.transform.localScale = new Vector3(0.04f * scale, 0.04f * scale, 0.04f * scale);
            _timerDisplay.layer = LayerMask.NameToLayer("UI3D");

            _timerText = _timerDisplay.AddComponent<TextMesh>();
            _timerText.text = "";
            _timerText.fontSize = 36;
            _timerText.alignment = TextAlignment.Center;
            _timerText.anchor = TextAnchor.MiddleCenter;
            _timerText.color = Color.white;

            // Hidden initially - shown when timer starts
            _timerDisplay.SetActive(false);
        }

        private void CreateRematchButton(float x, float y, float scale)
        {
            _rematchButton = GameObject.CreatePrimitive(PrimitiveType.Cube);
            _rematchButton.name = "Button_Rematch";
            _rematchButton.transform.SetParent(_buttonsContainer.transform);
            _rematchButton.transform.localPosition = new Vector3(x, y, -0.08f);
            _rematchButton.transform.localRotation = Quaternion.identity;
            _rematchButton.transform.localScale = new Vector3(1.4f * scale, 0.35f * scale, 0.05f);
            _rematchButton.layer = LayerMask.NameToLayer("UI3D");

            _rematchButtonRenderer = _rematchButton.GetComponent<Renderer>();
            if (buttonMaterial != null)
                _rematchButtonRenderer.material = new Material(buttonMaterial);
            else
                _rematchButtonRenderer.material = new Material(Shader.Find("Standard"));
            _rematchButtonRenderer.material.color = _pendingColor;
            _rematchButtonRenderer.shadowCastingMode = ShadowCastingMode.Off;

            // Button text
            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(_rematchButton.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.035f, 0.12f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            _rematchButtonText = textObj.AddComponent<TextMesh>();
            _rematchButtonText.text = "Rematch?";
            _rematchButtonText.fontSize = 36;
            _rematchButtonText.alignment = TextAlignment.Center;
            _rematchButtonText.anchor = TextAnchor.MiddleCenter;
            _rematchButtonText.color = Color.white;

            var handler = _rematchButton.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = OnRematchButtonClicked;

            _screenItems.Add(_rematchButton);
        }

        private void CreateDeclineButton(float x, float y, float scale)
        {
            _declineButton = GameObject.CreatePrimitive(PrimitiveType.Cube);
            _declineButton.name = "Button_Decline";
            _declineButton.transform.SetParent(_buttonsContainer.transform);
            _declineButton.transform.localPosition = new Vector3(x, y, -0.08f);
            _declineButton.transform.localRotation = Quaternion.identity;
            _declineButton.transform.localScale = new Vector3(0.9f * scale, 0.35f * scale, 0.05f);  // Smaller
            _declineButton.layer = LayerMask.NameToLayer("UI3D");

            var renderer = _declineButton.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = buttonMaterial;
            else
                renderer.material.color = new Color(0.4f, 0.25f, 0.25f);  // Reddish gray
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Button text
            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(_declineButton.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.045f, 0.12f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "Decline";
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            var handler = _declineButton.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = OnDeclineButtonClicked;

            _screenItems.Add(_declineButton);
        }

        private void OnRematchButtonClicked()
        {
            _localPlayerConfirmed = !_localPlayerConfirmed;

            var status = _localPlayerConfirmed ? RematchStatus.Confirmed : RematchStatus.Pending;

            if (NetworkedGameManager.Instance?.IsOnlineGame == true)
            {
                // Send via network
                var netStatus = new NetworkRematchStatus
                {
                    PlayerIndex = (byte)NetworkedGameManager.Instance.LocalPlayer,
                    Status = (byte)status,
                    TimerStartTime = 0,  // Host will set if needed
                    TimerDuration = 0
                };
                NetworkGameBridge.Instance?.RequestRematchStatusServerRpc(netStatus);
            }
            else
            {
                // Local game - directly update RematchManager
                if (GameManager.Instance?.GameState != null)
                {
                    RematchManager.Instance?.SetPlayerStatus(
                        GameManager.Instance.GameState.CurrentPlayer,
                        status
                    );
                }
            }

            UpdateRematchButtonVisual();
        }

        private void OnDeclineButtonClicked()
        {
            // Set declined status
            if (NetworkedGameManager.Instance?.IsOnlineGame == true)
            {
                var netStatus = new NetworkRematchStatus
                {
                    PlayerIndex = (byte)NetworkedGameManager.Instance.LocalPlayer,
                    Status = (byte)RematchStatus.Declined,
                    TimerStartTime = 0,
                    TimerDuration = 0
                };
                NetworkGameBridge.Instance?.RequestRematchStatusServerRpc(netStatus);
            }

            // Return to main menu
            Hide();
            CleanupAndReturnToMenu();
        }

        private void UpdateRematchButtonVisual()
        {
            if (_rematchButton == null || _rematchButtonRenderer == null) return;

            if (_localPlayerConfirmed)
            {
                _rematchButtonRenderer.material.color = _confirmedColor;
                // Text updated in Update() loop with timer if active
                if (RematchManager.Instance?.IsTimerActive != true && _rematchButtonText != null)
                {
                    _rematchButtonText.text = "Rematch!";
                }
            }
            else
            {
                _rematchButtonRenderer.material.color = _pendingColor;
                if (_rematchButtonText != null)
                {
                    _rematchButtonText.text = "Rematch?";
                }
            }
        }

        /// <summary>
        /// Gets the color for a specific player.
        /// </summary>
        private Color GetColorForPlayer(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return yellowColor;
                case Player.Blue: return blueColor;
                case Player.Purple: return purpleColor;
                case Player.Pink: return pinkColor;
                default: return Color.white;
            }
        }

        /// <summary>
        /// Gets the display name for a specific player.
        /// </summary>
        private string GetNameForPlayer(Player player)
        {
            return player.ToString().ToUpper();
        }

        /// <summary>
        /// Gets column X positions based on player count.
        /// Columns are shifted right to make room for left-aligned labels.
        /// </summary>
        private float[] GetColumnPositions(int playerCount, float scale)
        {
            // Labels on left, player columns to the right but more centered overall
            switch (playerCount)
            {
                case 2:
                    return new float[] { 0.2f * scale, 1.0f * scale };
                case 3:
                    return new float[] { 0.1f * scale, 0.65f * scale, 1.2f * scale };
                case 4:
                    return new float[] { -0.05f * scale, 0.4f * scale, 0.85f * scale, 1.3f * scale };
                default:
                    return new float[] { 0.2f * scale, 1.0f * scale };
            }
        }

        /// <summary>
        /// Gets the X position for stat labels (left side of panel).
        /// </summary>
        private float GetLabelXPosition(float scale)
        {
            return -1.5f * scale;
        }

        /// <summary>
        /// Gets the panel width multiplier based on player count.
        /// </summary>
        private float GetPanelWidthMultiplier(int playerCount)
        {
            switch (playerCount)
            {
                case 3: return 1.2f;
                case 4: return 1.4f;
                default: return 1.0f;
            }
        }

        private void CreateWinnerBanner(Player? winner, float yPos, float scale)
        {
            GameObject bannerObj = new GameObject("WinnerBanner");
            bannerObj.transform.SetParent(_statsPanel.transform);
            bannerObj.transform.localPosition = new Vector3(0f, yPos, -0.1f);
            bannerObj.transform.localRotation = Quaternion.identity;
            bannerObj.transform.localScale = new Vector3(0.08f, 0.08f, 0.08f) * scale;
            bannerObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = bannerObj.AddComponent<TextMesh>();
            if (winner.HasValue)
            {
                textMesh.text = $"{GetNameForPlayer(winner.Value)} WINS!";
                textMesh.color = GetColorForPlayer(winner.Value);
            }
            else
            {
                textMesh.text = "IT'S A TIE!";
                textMesh.color = winnerColor;
            }
            textMesh.fontSize = 48;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.fontStyle = FontStyle.Bold;
        }

        private void CreateColumnHeaders(float yPos, float scale, int playerCount, Player[] activePlayers)
        {
            var positions = GetColumnPositions(playerCount, scale);
            // Smaller text for 4 players to prevent overlap
            float headerScale = playerCount >= 4 ? 0.032f : 0.04f;
            for (int i = 0; i < playerCount && i < activePlayers.Length; i++)
            {
                var player = activePlayers[i];
                CreateText(_statsPanel, GetNameForPlayer(player), positions[i], yPos, headerScale * scale,
                    GetColorForPlayer(player), TextAlignment.Center);

                // Add status indicator above player name (only for online games)
                if (NetworkedGameManager.Instance?.IsOnlineGame == true)
                {
                    CreatePlayerStatusIndicator(player, positions[i], yPos + 0.25f * scale, scale);
                }
            }
        }

        private void CreatePlayerStatusIndicator(Player player, float x, float y, float scale)
        {
            GameObject indicatorObj = new GameObject($"StatusIndicator_{player}");
            indicatorObj.transform.SetParent(_statsPanel.transform);
            indicatorObj.transform.localPosition = new Vector3(x, y, -0.1f);
            indicatorObj.transform.localRotation = Quaternion.identity;
            indicatorObj.transform.localScale = new Vector3(0.05f * scale, 0.05f * scale, 0.05f * scale);
            indicatorObj.layer = LayerMask.NameToLayer("UI3D");

            var indicatorText = indicatorObj.AddComponent<TextMesh>();
            indicatorText.text = "";  // Hidden initially
            indicatorText.fontSize = 36;
            indicatorText.alignment = TextAlignment.Center;
            indicatorText.anchor = TextAnchor.MiddleCenter;
            indicatorText.color = Color.white;

            _playerStatusIndicators[player] = indicatorText;
        }

        private void CreateStatRow(string label, string[] values, Player[] players, float yPos, float scale, int playerCount)
        {
            // Label on left, left-aligned
            float labelX = GetLabelXPosition(scale);
            CreateText(_statsPanel, label, labelX, yPos, 0.035f * scale, statLabelColor, TextAlignment.Left);

            // Player values at dynamic positions (shifted right)
            var positions = GetColumnPositions(playerCount, scale);
            for (int i = 0; i < playerCount && i < values.Length && i < players.Length; i++)
            {
                CreateText(_statsPanel, values[i], positions[i], yPos, 0.04f * scale,
                    GetColorForPlayer(players[i]), TextAlignment.Center);
            }
        }

        private void CreateText(GameObject parent, string text, float x, float y, float textScale, Color color, TextAlignment alignment)
        {
            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(parent.transform);
            textObj.transform.localPosition = new Vector3(x, y, -0.1f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(textScale, textScale, textScale);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 36;
            textMesh.alignment = alignment;
            // Use appropriate anchor based on alignment
            textMesh.anchor = alignment == TextAlignment.Left ? TextAnchor.MiddleLeft : TextAnchor.MiddleCenter;
            textMesh.color = color;
        }

        /// <summary>
        /// Creates a button and returns its TextMesh for later modification.
        /// </summary>
        private TextMesh CreateButton(GameObject parent, string text, float x, float y, float scale, System.Action onClick)
        {
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"Button_{text}";
            btn.transform.SetParent(parent.transform);
            btn.transform.localPosition = new Vector3(x, y, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(1.4f * scale, 0.35f * scale, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = buttonMaterial;
            else
                renderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Button text
            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btn.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.035f, 0.12f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = onClick;

            _screenItems.Add(btn);

            return textMesh;
        }

        #region Rematch Event Handling

        private void SubscribeToRematchEvents()
        {
            // Ensure RematchManager exists
            if (RematchManager.Instance == null)
            {
                var managerObj = new GameObject("RematchManager");
                managerObj.AddComponent<RematchManager>();
                DontDestroyOnLoad(managerObj);
            }

            if (RematchManager.Instance != null)
            {
                RematchManager.Instance.OnPlayerStatusChanged += OnPlayerRematchStatusChanged;
                RematchManager.Instance.OnRematchConfirmed += OnRematchConfirmed;
                RematchManager.Instance.OnRematchCancelled += OnRematchCancelled;
                RematchManager.Instance.OnTimerExpired += OnRematchTimerExpired;
            }
        }

        private void UnsubscribeFromRematchEvents()
        {
            if (RematchManager.Instance != null)
            {
                RematchManager.Instance.OnPlayerStatusChanged -= OnPlayerRematchStatusChanged;
                RematchManager.Instance.OnRematchConfirmed -= OnRematchConfirmed;
                RematchManager.Instance.OnRematchCancelled -= OnRematchCancelled;
                RematchManager.Instance.OnTimerExpired -= OnRematchTimerExpired;
            }
        }

        private void OnPlayerRematchStatusChanged(Player player, RematchStatus status)
        {
            // Update the status indicator for this player
            if (_playerStatusIndicators.TryGetValue(player, out var indicator))
            {
                switch (status)
                {
                    case RematchStatus.Confirmed:
                        indicator.text = "\u2713";  // Checkmark
                        indicator.color = _confirmedColor;
                        break;
                    case RematchStatus.Declined:
                        indicator.text = "\u2717";  // X mark
                        indicator.color = Color.red;
                        break;
                    case RematchStatus.Pending:
                    default:
                        indicator.text = "";  // Hidden
                        break;
                }
            }

            // Also update rematch button if this is the local player
            if (NetworkedGameManager.Instance?.IsOnlineGame == true)
            {
                if (player == NetworkedGameManager.Instance.LocalPlayer)
                {
                    _localPlayerConfirmed = (status == RematchStatus.Confirmed);
                    UpdateRematchButtonVisual();
                }
            }
        }

        private void OnRematchConfirmed(System.Collections.Generic.List<Player> confirmedPlayers)
        {
            Debug.Log($"[EndGameScreen] Rematch confirmed with {confirmedPlayers.Count} players");

            Hide();

            // Start new game with confirmed players
            if (NetworkedGameManager.Instance?.IsOnlineGame == true)
            {
                if (GlyphtenderLobby.Instance?.IsHost == true)
                {
                    // Host starts new game with confirmed player count
                    GameManager.Instance?.InitializeGame();
                }
                // Non-host waits for host to send NetworkGameStart
            }
            else
            {
                // Local game - just restart
                GameManager.Instance?.InitializeGame();
            }
        }

        private void OnRematchCancelled()
        {
            Debug.Log("[EndGameScreen] Rematch cancelled - not enough players");

            Hide();
            CleanupAndReturnToMenu();
        }

        private void OnRematchTimerExpired()
        {
            Debug.Log("[EndGameScreen] Rematch timer expired");
            // The RematchManager will fire OnRematchConfirmed or OnRematchCancelled
        }

        private void CleanupAndReturnToMenu()
        {
            // Set flag so game waits for main menu
            if (GameManager.Instance != null)
            {
                GameManager.Instance.WaitingForMainMenu = true;
            }

            // Clean up network if online
            if (NetworkedGameManager.Instance?.IsOnlineGame == true)
            {
                // Disconnect relay (this shuts down NetworkManager)
                GlyphtenderRelay.Instance?.Disconnect();

                // Leave lobby (fire and forget the async call)
                _ = GlyphtenderLobby.Instance?.LeaveLobbyAsync();
            }

            // Clear the board
            BoardRenderer.Instance?.ClearBoard();

            // Show main menu
            MainMenuScreen.Instance?.Show();
        }

        #endregion
    }
}