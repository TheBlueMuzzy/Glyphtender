using UnityEngine;
using UnityEngine.Rendering;
using System.Collections.Generic;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Play mode options for the main menu.
    /// </summary>
    public enum PlayMode
    {
        Local2P,    // Human vs Human
        VsAI,       // Human (Yellow) vs AI (Blue)
        AIvsAI      // AI vs AI
    }

    /// <summary>
    /// Main menu screen shown before game starts.
    /// Allows player to select play mode and AI settings.
    /// Uses 3D UI pattern matching MenuController/EndGameScreen.
    /// </summary>
    public class MainMenuScreen : MonoBehaviour
    {
        public static MainMenuScreen Instance { get; private set; }

        [Header("References")]
        public Camera uiCamera;

        [Header("Appearance")]
        public Material panelMaterial;
        public Material buttonMaterial;
        public float panelWidth = 6.0f;
        public float panelHeight = 7.0f;
        public float menuZ = 5f;

        [Header("Colors")]
        public Color titleColor = new Color(0.9f, 0.85f, 0.7f);
        public Color labelColor = new Color(0.7f, 0.7f, 0.75f);
        public Color valueColor = new Color(0.85f, 0.9f, 1f);
        public Color playButtonColor = new Color(0.3f, 0.5f, 0.3f);

        [Header("Animation")]
        public float openDuration = 0.2f;
        public float closeDuration = 0.15f;

        // Menu state
        private bool _isVisible;
        private GameObject _menuRoot;
        private GameObject _backgroundBlocker;
        private List<GameObject> _menuItems = new List<GameObject>();

        // Current settings
        private PlayMode _currentPlayMode = PlayMode.VsAI;
        private string[] _personalities = { "Bully", "Scholar", "Builder", "Balanced" };
        private string[] _difficulties = { "Apprentice", "1st Class", "Archmage" };
        private int _bluePersonalityIndex = 0;
        private int _blueDifficultyIndex = 0;
        private int _yellowPersonalityIndex = 0;
        private int _yellowDifficultyIndex = 0;

        // UI element references for show/hide
        private GameObject _bluePersonalityRow;
        private GameObject _blueDifficultyRow;
        private GameObject _yellowPersonalityRow;
        private GameObject _yellowDifficultyRow;
        private TextMesh _playModeText;
        private TextMesh _bluePersonalityText;
        private TextMesh _blueDifficultyText;
        private TextMesh _yellowPersonalityText;
        private TextMesh _yellowDifficultyText;

        // Animation
        private bool _isAnimating;
        private float _animationTime;
        private Vector3 _animationStartScale;
        private Vector3 _animationEndScale;

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

            // Subscribe to game initialized event to hide menu
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized += OnGameInitialized;
            }

            // Show menu on start if game is waiting
            if (GameManager.Instance != null && GameManager.Instance.WaitingForMainMenu)
            {
                Show();
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized -= OnGameInitialized;
            }
        }

        private void Update()
        {
            if (_isAnimating)
            {
                _animationTime += Time.deltaTime;
                float duration = _animationEndScale == Vector3.zero ? closeDuration : openDuration;
                float t = Mathf.Clamp01(_animationTime / duration);
                float eased = 1f - Mathf.Pow(1f - t, 3f);

                _menuRoot.transform.localScale = Vector3.Lerp(_animationStartScale, _animationEndScale, eased);

                if (t >= 1f)
                {
                    _isAnimating = false;
                    if (_animationEndScale == Vector3.zero)
                    {
                        _menuRoot.SetActive(false);
                        _backgroundBlocker.SetActive(false);
                    }
                }
            }
        }

        private void OnGameInitialized()
        {
            Hide();
        }

        /// <summary>
        /// Shows the main menu.
        /// </summary>
        public void Show()
        {
            if (_isVisible) return;

            _isVisible = true;

            // Destroy old menu if exists
            if (_menuRoot != null)
            {
                Destroy(_menuRoot);
            }

            CreateMenu();

            // Hide hand and menu button while main menu is open
            HandController.Instance?.HideHand();
            GameUIController.Instance?.HideMenuButton();

            // Animate in
            _menuRoot.SetActive(true);
            _backgroundBlocker.SetActive(true);
            _animationStartScale = Vector3.zero;
            _animationEndScale = Vector3.one;
            _menuRoot.transform.localScale = _animationStartScale;
            _animationTime = 0f;
            _isAnimating = true;
        }

        /// <summary>
        /// Hides the main menu.
        /// </summary>
        public void Hide()
        {
            if (!_isVisible) return;

            _isVisible = false;

            // Animate out
            _animationStartScale = Vector3.one;
            _animationEndScale = Vector3.zero;
            _animationTime = 0f;
            _isAnimating = true;

            // Show hand and menu button
            HandController.Instance?.ShowHand();
            GameUIController.Instance?.ShowMenuButton();
        }

        private void CreateMenu()
        {
            _menuRoot = new GameObject("MainMenuPanel");
            _menuRoot.transform.SetParent(uiCamera.transform);
            _menuRoot.transform.localPosition = new Vector3(0f, 0f, menuZ);
            _menuRoot.transform.localRotation = Quaternion.identity;
            _menuRoot.layer = LayerMask.NameToLayer("UI3D");

            CreateBackgroundBlocker();
            CreatePanelBackground();
            CreateMenuContent();
        }

        private void CreateBackgroundBlocker()
        {
            _backgroundBlocker = GameObject.CreatePrimitive(PrimitiveType.Quad);
            _backgroundBlocker.name = "BackgroundBlocker";
            _backgroundBlocker.transform.SetParent(uiCamera.transform);
            _backgroundBlocker.transform.localPosition = new Vector3(0f, 0f, menuZ + 0.5f);
            _backgroundBlocker.transform.localRotation = Quaternion.identity;
            _backgroundBlocker.transform.localScale = new Vector3(50f, 50f, 1f);
            _backgroundBlocker.layer = LayerMask.NameToLayer("UI3D");

            var renderer = _backgroundBlocker.GetComponent<Renderer>();
            Material invisMat = new Material(Shader.Find("Standard"));
            invisMat.color = new Color(0, 0, 0, 0.5f);
            invisMat.SetFloat("_Mode", 3);
            invisMat.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            invisMat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            invisMat.SetInt("_ZWrite", 0);
            invisMat.DisableKeyword("_ALPHATEST_ON");
            invisMat.EnableKeyword("_ALPHABLEND_ON");
            invisMat.renderQueue = 3000;
            renderer.material = invisMat;
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Consume clicks
            var handler = _backgroundBlocker.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => { };
        }

        private void CreatePanelBackground()
        {
            GameObject panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = "PanelBackground";
            panel.transform.SetParent(_menuRoot.transform);
            panel.transform.localPosition = Vector3.zero;
            panel.transform.localRotation = Quaternion.identity;
            panel.transform.localScale = new Vector3(panelWidth, panelHeight, 0.05f);
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
        }

        private void CreateMenuContent()
        {
            float elementScale = panelHeight / 5.0f;
            float contentTop = (panelHeight / 2f) - (0.5f * elementScale);
            float rowSpacing = 0.55f * elementScale;

            float yPos = contentTop;

            // Title: GLYPHTENDER
            CreateTitle(yPos, elementScale);
            yPos -= 0.8f * elementScale;

            // Play Mode row
            CreatePlayModeRow(yPos, elementScale);
            yPos -= rowSpacing;

            // Blue AI Personality row (visible in VsAI and AIvsAI)
            _bluePersonalityRow = CreateSettingRow("Blue AI", yPos, elementScale,
                () => {
                    _bluePersonalityIndex = (_bluePersonalityIndex + 1) % _personalities.Length;
                    return _personalities[_bluePersonalityIndex];
                },
                () => _personalities[_bluePersonalityIndex],
                out _bluePersonalityText);
            yPos -= rowSpacing;

            // Blue AI Difficulty row
            _blueDifficultyRow = CreateSettingRow("Blue Lvl", yPos, elementScale,
                () => {
                    _blueDifficultyIndex = (_blueDifficultyIndex + 1) % _difficulties.Length;
                    return _difficulties[_blueDifficultyIndex];
                },
                () => _difficulties[_blueDifficultyIndex],
                out _blueDifficultyText);
            yPos -= rowSpacing;

            // Yellow AI Personality row (visible only in AIvsAI)
            _yellowPersonalityRow = CreateSettingRow("Yellow AI", yPos, elementScale,
                () => {
                    _yellowPersonalityIndex = (_yellowPersonalityIndex + 1) % _personalities.Length;
                    return _personalities[_yellowPersonalityIndex];
                },
                () => _personalities[_yellowPersonalityIndex],
                out _yellowPersonalityText);
            yPos -= rowSpacing;

            // Yellow AI Difficulty row
            _yellowDifficultyRow = CreateSettingRow("Yellow Lvl", yPos, elementScale,
                () => {
                    _yellowDifficultyIndex = (_yellowDifficultyIndex + 1) % _difficulties.Length;
                    return _difficulties[_yellowDifficultyIndex];
                },
                () => _difficulties[_yellowDifficultyIndex],
                out _yellowDifficultyText);

            // Play button at bottom
            float buttonY = -(panelHeight / 2f) + (0.7f * elementScale);
            CreatePlayButton(buttonY, elementScale);

            // Quit button below Play (hidden in WebGL)
#if !UNITY_WEBGL
            float closeY = buttonY - (0.5f * elementScale);
            CreateCloseButton(closeY, elementScale);
#endif

            // Update visibility based on initial play mode
            UpdateRowVisibility();
        }

        private void CreateTitle(float yPos, float scale)
        {
            GameObject titleObj = new GameObject("Title");
            titleObj.transform.SetParent(_menuRoot.transform);
            titleObj.transform.localPosition = new Vector3(0f, yPos, -0.1f);
            titleObj.transform.localRotation = Quaternion.identity;
            titleObj.transform.localScale = new Vector3(0.08f, 0.08f, 0.08f) * scale;
            titleObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = titleObj.AddComponent<TextMesh>();
            textMesh.text = "GLYPHTENDER";
            textMesh.fontSize = 48;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = titleColor;
            textMesh.fontStyle = FontStyle.Bold;
        }

        private void CreatePlayModeRow(float yPos, float scale)
        {
            // Label
            GameObject labelObj = new GameObject("PlayModeLabel");
            labelObj.transform.SetParent(_menuRoot.transform);
            labelObj.transform.localPosition = new Vector3(-1.0f * scale, yPos, -0.1f);
            labelObj.transform.localRotation = Quaternion.identity;
            labelObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f) * scale;
            labelObj.layer = LayerMask.NameToLayer("UI3D");

            var labelText = labelObj.AddComponent<TextMesh>();
            labelText.text = "Mode";
            labelText.fontSize = 36;
            labelText.alignment = TextAlignment.Left;
            labelText.anchor = TextAnchor.MiddleLeft;
            labelText.color = labelColor;

            // Button
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = "PlayModeButton";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = new Vector3(0.6f * scale, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(1.4f * scale, 0.35f * scale, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = buttonMaterial;
            else
                renderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Value text
            GameObject valueObj = new GameObject("Value");
            valueObj.transform.SetParent(btn.transform);
            valueObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            valueObj.transform.localRotation = Quaternion.identity;
            valueObj.transform.localScale = new Vector3(0.035f, 0.12f, 1f);
            valueObj.layer = LayerMask.NameToLayer("UI3D");

            _playModeText = valueObj.AddComponent<TextMesh>();
            _playModeText.text = GetPlayModeText();
            _playModeText.fontSize = 36;
            _playModeText.alignment = TextAlignment.Center;
            _playModeText.anchor = TextAnchor.MiddleCenter;
            _playModeText.color = valueColor;

            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => {
                CyclePlayMode();
                _playModeText.text = GetPlayModeText();
                UpdateRowVisibility();
            };

            _menuItems.Add(btn);
        }

        private GameObject CreateSettingRow(string label, float yPos, float scale,
            System.Func<string> onToggle, System.Func<string> getValue, out TextMesh valueText)
        {
            GameObject rowContainer = new GameObject($"Row_{label}");
            rowContainer.transform.SetParent(_menuRoot.transform);
            rowContainer.transform.localPosition = Vector3.zero;
            rowContainer.transform.localRotation = Quaternion.identity;

            // Label
            GameObject labelObj = new GameObject("Label");
            labelObj.transform.SetParent(rowContainer.transform);
            labelObj.transform.localPosition = new Vector3(-1.0f * scale, yPos, -0.1f);
            labelObj.transform.localRotation = Quaternion.identity;
            labelObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f) * scale;
            labelObj.layer = LayerMask.NameToLayer("UI3D");

            var labelText = labelObj.AddComponent<TextMesh>();
            labelText.text = label;
            labelText.fontSize = 36;
            labelText.alignment = TextAlignment.Left;
            labelText.anchor = TextAnchor.MiddleLeft;
            labelText.color = labelColor;

            // Button
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = "Button";
            btn.transform.SetParent(rowContainer.transform);
            btn.transform.localPosition = new Vector3(0.6f * scale, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(1.4f * scale, 0.35f * scale, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                renderer.material = buttonMaterial;
            else
                renderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Value text
            GameObject valueObj = new GameObject("Value");
            valueObj.transform.SetParent(btn.transform);
            valueObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            valueObj.transform.localRotation = Quaternion.identity;
            valueObj.transform.localScale = new Vector3(0.035f, 0.12f, 1f);
            valueObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = valueObj.AddComponent<TextMesh>();
            textMesh.text = getValue();
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = valueColor;

            // Assign out parameter before lambda capture
            valueText = textMesh;

            // Capture local reference for lambda
            var capturedText = textMesh;
            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => {
                capturedText.text = onToggle();
            };

            _menuItems.Add(btn);

            return rowContainer;
        }

        private void CreatePlayButton(float yPos, float scale)
        {
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = "PlayButton";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = new Vector3(0f, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(2f * scale, 0.45f * scale, 0.05f);
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
            {
                renderer.material = new Material(buttonMaterial);
                renderer.material.color = playButtonColor;
            }
            else
            {
                renderer.material.color = playButtonColor;
            }
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Button text
            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btn.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.03f, 0.1f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "PLAY";
            textMesh.fontSize = 48;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;
            textMesh.fontStyle = FontStyle.Bold;

            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = OnPlayClicked;

            _menuItems.Add(btn);
        }

#if !UNITY_WEBGL
        private void CreateCloseButton(float yPos, float scale)
        {
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = "CloseButton";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = new Vector3(0f, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(1.2f * scale, 0.35f * scale, 0.05f);
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
            textObj.transform.localScale = new Vector3(0.04f, 0.12f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "Quit";
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => {
                Application.Quit();
#if UNITY_EDITOR
                UnityEditor.EditorApplication.isPlaying = false;
#endif
            };

            _menuItems.Add(btn);
        }
#endif

        private void CyclePlayMode()
        {
            switch (_currentPlayMode)
            {
                case PlayMode.Local2P:
                    _currentPlayMode = PlayMode.VsAI;
                    break;
                case PlayMode.VsAI:
                    _currentPlayMode = PlayMode.AIvsAI;
                    break;
                case PlayMode.AIvsAI:
                    _currentPlayMode = PlayMode.Local2P;
                    break;
            }
        }

        private string GetPlayModeText()
        {
            switch (_currentPlayMode)
            {
                case PlayMode.Local2P: return "Local 2P";
                case PlayMode.VsAI: return "vs AI";
                case PlayMode.AIvsAI: return "AI vs AI";
                default: return "vs AI";
            }
        }

        private void UpdateRowVisibility()
        {
            bool showBlueAI = _currentPlayMode == PlayMode.VsAI || _currentPlayMode == PlayMode.AIvsAI;
            bool showYellowAI = _currentPlayMode == PlayMode.AIvsAI;

            if (_bluePersonalityRow != null)
                _bluePersonalityRow.SetActive(showBlueAI);
            if (_blueDifficultyRow != null)
                _blueDifficultyRow.SetActive(showBlueAI);
            if (_yellowPersonalityRow != null)
                _yellowPersonalityRow.SetActive(showYellowAI);
            if (_yellowDifficultyRow != null)
                _yellowDifficultyRow.SetActive(showYellowAI);
        }

        private void OnPlayClicked()
        {
            // Ensure AIManager exists before we configure it
            EnsureAIManagerExists();

            // Configure AI based on selected settings
            ConfigureAI();

            // Start the game
            if (GameManager.Instance != null)
            {
                GameManager.Instance.InitializeGame();
            }
        }

        private void EnsureAIManagerExists()
        {
            if (AIManager.Instance != null) return;

            // Find or create AIManager
            var aiManager = Object.FindObjectOfType<AIManager>();
            if (aiManager == null)
            {
                var aiManagerObj = new GameObject("AIManager");
                aiManager = aiManagerObj.AddComponent<AIManager>();
            }
        }

        private void ConfigureAI()
        {
            var aiManager = AIManager.Instance;
            if (aiManager == null)
            {
                Debug.LogError("AIManager not found after EnsureAIManagerExists!");
                return;
            }

            ApplyAISettings(aiManager);
        }

        private void ApplyAISettings(AIManager aiManager)
        {
            // Yellow AI
            if (_currentPlayMode == PlayMode.AIvsAI)
            {
                if (aiManager.YellowAI != null)
                {
                    aiManager.YellowAI.enabled = true;
                    aiManager.YellowAI.SetPersonality(_personalities[_yellowPersonalityIndex]);
                    aiManager.YellowAI.SetDifficulty(GetDifficulty(_yellowDifficultyIndex));
                }
            }
            else
            {
                if (aiManager.YellowAI != null)
                {
                    aiManager.YellowAI.enabled = false;
                }
            }

            // Blue AI
            if (_currentPlayMode == PlayMode.VsAI || _currentPlayMode == PlayMode.AIvsAI)
            {
                if (aiManager.BlueAI != null)
                {
                    aiManager.BlueAI.enabled = true;
                    aiManager.BlueAI.SetPersonality(_personalities[_bluePersonalityIndex]);
                    aiManager.BlueAI.SetDifficulty(GetDifficulty(_blueDifficultyIndex));
                }
            }
            else
            {
                if (aiManager.BlueAI != null)
                {
                    aiManager.BlueAI.enabled = false;
                }
            }
        }

        private AIDifficulty GetDifficulty(int index)
        {
            switch (index)
            {
                case 0: return AIDifficulty.Apprentice;
                case 1: return AIDifficulty.FirstClass;
                case 2: return AIDifficulty.Archmage;
                default: return AIDifficulty.Apprentice;
            }
        }
    }
}