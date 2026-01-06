using UnityEngine;
using Glyphtender.Core;
using Glyphtender.Unity.Network;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Manages the player's hand of tiles in 3D space.
    /// Attached to UI camera so it stays fixed during board zoom/pan.
    /// During draft phase, shows unplaced glyphlings instead of tiles.
    /// </summary>
    public class HandController : MonoBehaviour
    {
        public static HandController Instance { get; private set; }

        [Header("Camera")]
        public Camera uiCamera;

        [Header("Layout")]
        [Tooltip("Distance between tile centers")]
        public float tileSpacing = 1.3f;

        [Tooltip("Size of each tile (when equal to tileSpacing, they touch)")]
        public float tileSize = 1.25f;

        [Tooltip("Max tiles the hand can hold (for width calculation)")]
        public int maxHandSize = 8;

        [Header("Portrait Offset")]
        [Tooltip("Additional Y offset for hand in portrait mode (positive = higher on screen)")]
        public float portraitYOffset = 2f;

        [Header("Animation")]
        public float toggleDuration = 0.2f;

        [Header("Hand Scaling")]
        [Tooltip("User preference multiplier (menu slider)")]
        public float userHandScale = 1f;

        [Tooltip("Scale of hand when not ready to place a letter")]
        public float handInactiveScale = 1.0f;
        public float handScaleDuration = 0.15f;

        [Header("Prefabs")]
        [Tooltip("Prefab for glyphlings in hand during draft. If null, uses sphere fallback.")]
        public GameObject glyphlingPrefab;

        [Tooltip("Prefab for letter tiles in hand. If null, uses cylinder fallback.")]
        public GameObject tilePrefab;

        [Header("Materials")]
        public Material yellowTileMaterial;
        public Material blueTileMaterial;
        public Material purpleTileMaterial;
        public Material pinkTileMaterial;
        public Material selectedMaterial;
        public Material yellowGlyphlingMaterial;
        public Material blueGlyphlingMaterial;
        public Material purpleGlyphlingMaterial;
        public Material pinkGlyphlingMaterial;

        /// <summary>
        /// Gets the appropriate glyphling material for a player.
        /// </summary>
        private Material GetGlyphlingMaterial(Player player)
        {
            switch (player)
            {
                case Player.Yellow:
                    return yellowGlyphlingMaterial != null ? yellowGlyphlingMaterial : yellowTileMaterial;
                case Player.Blue:
                    return blueGlyphlingMaterial != null ? blueGlyphlingMaterial : blueTileMaterial;
                case Player.Purple:
                    return purpleGlyphlingMaterial != null ? purpleGlyphlingMaterial : BoardRenderer.Instance?.purpleMaterial;
                case Player.Pink:
                    return pinkGlyphlingMaterial != null ? pinkGlyphlingMaterial : BoardRenderer.Instance?.pinkMaterial;
                default:
                    return yellowGlyphlingMaterial;
            }
        }

        /// <summary>
        /// Gets the appropriate tile material for a player.
        /// </summary>
        private Material GetTileMaterial(Player player)
        {
            switch (player)
            {
                case Player.Yellow:
                    return yellowTileMaterial;
                case Player.Blue:
                    return blueTileMaterial;
                case Player.Purple:
                    return purpleTileMaterial != null ? purpleTileMaterial : BoardRenderer.Instance?.purpleMaterial;
                case Player.Pink:
                    return pinkTileMaterial != null ? pinkTileMaterial : BoardRenderer.Instance?.pinkMaterial;
                default:
                    return yellowTileMaterial;
            }
        }

        // Public state for GameUIController
        public bool IsInCycleMode => _isInCycleMode;

        // Hand position (bottom dock only)
        private Vector3 _handUpPosition;
        private Vector3 _handDownPosition;
        private Quaternion _handRotation;

        // State
        private bool _isUp = true;
        private float _lerpTime;
        private Vector3 _lerpStart;
        private Vector3 _lerpTarget;
        private bool _isLerping;

        // Hand tiles
        private List<GameObject> _handTileObjects = new List<GameObject>();
        private List<char> _currentHand = new List<char>();
        private int _selectedIndex = -1;

        // Draft glyphlings in hand
        private List<GameObject> _handGlyphlingObjects = new List<GameObject>();
        private List<Glyphling> _currentDraftGlyphlings = new List<Glyphling>();
        private int _selectedDraftIndex = -1;

        // Anchor
        private Transform _handAnchor;

        // Cycle mode
        private bool _isInCycleMode;
        private HashSet<int> _selectedForDiscard = new HashSet<int>();

        // Hand scaling
        private bool _handIsActive = false;
        private Coroutine _handScaleCoroutine;
        private float _responsiveScale = 1f;

        private float _handDistance = 12f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Ensure SpriteLoader exists for runtime texture loading
            SpriteLoader.EnsureExists();

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
                    return;
                }
            }

            // Create hand anchor
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(uiCamera.transform);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshHand;
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            // Subscribe to UIScaler layout changes
            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged += OnLayoutChanged;
            }

            ApplyHandPosition();

            // Initialize responsive scaling
            _handIsActive = false;
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);

            RefreshHand();
        }

        private void Update()
        {
            if (uiCamera == null) return;

            // Handle toggle lerp
            if (_isLerping)
            {
                _lerpTime += Time.deltaTime;
                float t = Mathf.Clamp01(_lerpTime / toggleDuration);
                t = t * t * (3f - 2f * t); // Smooth step

                _handAnchor.localPosition = Vector3.Lerp(_lerpStart, _lerpTarget, t);

                if (t >= 1f)
                {
                    _isLerping = false;
                }
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshHand;
                GameManager.Instance.OnSelectionChanged -= OnSelectionChanged;
                GameManager.Instance.OnGameEnded -= OnGameEnded;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }

            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged -= OnLayoutChanged;
            }
        }

        /// <summary>
        /// Called by UIScaler when screen layout changes.
        /// </summary>
        private void OnLayoutChanged()
        {
            ApplyHandPosition();
            RefreshResponsiveScale();
        }

        #region Hand Positioning

        /// <summary>
        /// Calculates and applies hand position at bottom of screen.
        /// </summary>
        private void ApplyHandPosition()
        {
            float halfHeight = UIScaler.Instance != null ? UIScaler.Instance.HalfHeight : 5f;
            bool isPortrait = UIScaler.Instance != null && UIScaler.Instance.IsPortrait;

            // Hand anchor is rotated 180° on X, so negative Y appears at bottom
            float bottomY = -(halfHeight - 1f);  // Near bottom edge

            // Apply portrait offset (positive = higher on screen = less negative Y)
            if (isPortrait)
            {
                bottomY += portraitYOffset;
            }

            _handUpPosition = new Vector3(0f, bottomY, _handDistance);
            _handDownPosition = new Vector3(0f, -(halfHeight + 2f), _handDistance);
            _handRotation = Quaternion.Euler(180f, 0f, 0f);

            _handAnchor.localPosition = _isUp ? _handUpPosition : _handDownPosition;
            _handAnchor.localRotation = _handRotation;
        }

        #endregion

        // Cycle prompt text removed - TurnIndicator handles cycle mode instructions

        #region Hand Visibility

        /// <summary>
        /// Hides hand tiles when menu is open.
        /// </summary>
        public void HideHand()
        {
            if (_handAnchor != null)
            {
                _handAnchor.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// Shows hand tiles when menu closes.
        /// </summary>
        public void ShowHand()
        {
            if (_handAnchor != null)
            {
                _handAnchor.gameObject.SetActive(true);
            }
        }

        /// <summary>
        /// Toggle hand visibility (up/down).
        /// </summary>
        public void ToggleHand()
        {
            _isUp = !_isUp;
            _lerpStart = _handAnchor.localPosition;
            _lerpTarget = _isUp ? _handUpPosition : _handDownPosition;
            _lerpTime = 0f;
            _isLerping = true;
        }

        #endregion

        #region Responsive Scaling

        /// <summary>
        /// Calculates the responsive scale factor based on screen width and aspect ratio.
        /// Uses UIScaler for consistent responsive calculations.
        /// </summary>
        private float CalculateResponsiveScale()
        {
            if (UIScaler.Instance == null) return 1f;

            float naturalWidth = (maxHandSize - 1) * tileSpacing + tileSize;
            return UIScaler.Instance.GetWidthFillScale(naturalWidth);
        }

        /// <summary>
        /// Updates the hand anchor scale combining responsive, user, and active scales.
        /// </summary>
        private void UpdateHandScale(bool animate = false)
        {
            if (_handAnchor == null) return;

            float activeScale = _handIsActive ? 1f : handInactiveScale;
            float targetScale = _responsiveScale * userHandScale * activeScale;

            if (animate)
            {
                if (_handScaleCoroutine != null)
                {
                    StopCoroutine(_handScaleCoroutine);
                }
                _handScaleCoroutine = StartCoroutine(AnimateHandScale(targetScale));
            }
            else
            {
                _handAnchor.localScale = Vector3.one * targetScale;
            }
        }

        /// <summary>
        /// Recalculates responsive scale and updates hand.
        /// </summary>
        private void RefreshResponsiveScale()
        {
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);
        }

        private void SetHandActive(bool active)
        {
            _handIsActive = active;
            UpdateHandScale(animate: true);
        }

        private IEnumerator AnimateHandScale(float targetScale)
        {
            if (_handAnchor == null) yield break;

            Vector3 startScale = _handAnchor.localScale;
            Vector3 endScale = Vector3.one * targetScale;
            float elapsed = 0f;

            while (elapsed < handScaleDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / handScaleDuration;
                t = 1f - Mathf.Pow(1f - t, 3f);
                _handAnchor.localScale = Vector3.Lerp(startScale, endScale, t);
                yield return null;
            }

            _handAnchor.localScale = endScale;
            _handScaleCoroutine = null;
        }

        #endregion

        #region Hand Tiles

        /// <summary>
        /// Rebuild hand from current player's hand (tiles or draft glyphlings).
        /// </summary>
        public void RefreshHand()
        {
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;

            // Clear existing objects
            ClearHandObjects();

            // During draft phase, show unplaced glyphlings
            if (state.Phase == GamePhase.Draft)
            {
                RefreshDraftHand();
            }
            else
            {
                RefreshTileHand();
            }
        }

        /// <summary>
        /// Clears all hand objects (tiles and glyphlings).
        /// </summary>
        private void ClearHandObjects()
        {
            foreach (var obj in _handTileObjects)
            {
                Destroy(obj);
            }
            _handTileObjects.Clear();
            _currentHand.Clear();

            foreach (var obj in _handGlyphlingObjects)
            {
                Destroy(obj);
            }
            _handGlyphlingObjects.Clear();
            _currentDraftGlyphlings.Clear();

            _selectedIndex = -1;
            _selectedDraftIndex = -1;
        }

        /// <summary>
        /// Removes a glyphling object from hand tracking without destroying it.
        /// Called when the object is being transferred to the board.
        /// </summary>
        public void UntrackGlyphlingObject(GameObject obj)
        {
            if (_handGlyphlingObjects.Contains(obj))
            {
                _handGlyphlingObjects.Remove(obj);
                Debug.Log($"[HandController] Untracked glyphling '{obj.name}' from hand (will not be destroyed on refresh)");
            }
        }

        /// <summary>
        /// Removes a tile object from hand tracking without destroying it.
        /// Called when the object is being transferred to the board.
        /// </summary>
        public void UntrackTileObject(GameObject obj)
        {
            if (_handTileObjects.Contains(obj))
            {
                _handTileObjects.Remove(obj);
                Debug.Log($"[HandController] Untracked tile '{obj.name}' from hand (will not be destroyed on refresh)");
            }
        }

        /// <summary>
        /// Gets the player whose hand should be displayed.
        /// In online mode, always show local player's hand.
        /// In local mode, show current player's hand.
        /// </summary>
        private Player GetDisplayPlayer()
        {
            if (NetworkedGameManager.Instance != null && NetworkedGameManager.Instance.IsOnlineGame)
            {
                return NetworkedGameManager.Instance.LocalPlayer;
            }
            return GameManager.Instance.GameState.CurrentPlayer;
        }

        /// <summary>
        /// Shows letter tiles during play phase.
        /// </summary>
        private void RefreshTileHand()
        {
            var state = GameManager.Instance.GameState;

            // In online mode, always show local player's tiles (they can see their hand even when waiting)
            // But the hand is inactive when it's not their turn
            bool isOnline = NetworkedGameManager.Instance != null && NetworkedGameManager.Instance.IsOnlineGame;
            Player displayPlayer = GetDisplayPlayer();
            var hand = state.Hands[displayPlayer];

            float totalWidth = (hand.Count - 1) * tileSpacing;
            float startX = -totalWidth / 2f;

            for (int i = 0; i < hand.Count; i++)
            {
                char letter = hand[i];
                _currentHand.Add(letter);

                Vector3 localPos = new Vector3(startX + i * tileSpacing, 0f, 0f);
                GameObject tileObj = CreateHandTile(letter, localPos, i);
                _handTileObjects.Add(tileObj);
            }

            Debug.Log($"[HandController] RefreshTileHand: displayPlayer={displayPlayer}, " +
                $"handCount={hand.Count}, IsOnline={isOnline}");
        }

        /// <summary>
        /// Gets the player whose glyphlings should be shown during draft.
        /// In online mode, always show local player's glyphlings.
        /// In local mode, show current drafter's glyphlings.
        /// </summary>
        private Player GetDraftDisplayPlayer()
        {
            if (NetworkedGameManager.Instance != null && NetworkedGameManager.Instance.IsOnlineGame)
            {
                return NetworkedGameManager.Instance.LocalPlayer;
            }
            return GameManager.Instance.GameState.CurrentDrafter;
        }

        /// <summary>
        /// Shows unplaced glyphlings during draft phase.
        /// </summary>
        private void RefreshDraftHand()
        {
            var state = GameManager.Instance.GameState;

            // In online mode, only show hand when it's our turn to draft
            bool isOnline = NetworkedGameManager.Instance != null && NetworkedGameManager.Instance.IsOnlineGame;
            if (isOnline && !NetworkedGameManager.Instance.IsLocalPlayerTurn)
            {
                Debug.Log($"[HandController] RefreshDraftHand: Not our turn, hiding hand. " +
                    $"LocalPlayer={NetworkedGameManager.Instance.LocalPlayer}, CurrentDrafter={state.CurrentDrafter}");
                // Don't show any glyphlings - it's not our turn
                SetHandActive(false);
                return;
            }

            // In online mode, show local player's glyphlings; in local mode, show current drafter's
            Player displayPlayer = GetDraftDisplayPlayer();

            Debug.Log($"[HandController] RefreshDraftHand: displayPlayer={displayPlayer}, " +
                $"IsOnlineGame={isOnline}, " +
                $"LocalPlayer={NetworkedGameManager.Instance?.LocalPlayer}, " +
                $"CurrentDrafter={state.CurrentDrafter}");

            // Find unplaced glyphlings for the display player
            var unplacedGlyphlings = new List<Glyphling>();
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == displayPlayer && !g.IsPlaced)
                {
                    unplacedGlyphlings.Add(g);
                }
            }

            // Skip the one currently being placed (if any)
            var selectedDraft = GameManager.Instance.SelectedDraftGlyphling;

            float totalWidth = (unplacedGlyphlings.Count - 1) * tileSpacing;
            float startX = -totalWidth / 2f;

            int displayIndex = 0;
            for (int i = 0; i < unplacedGlyphlings.Count; i++)
            {
                var glyphling = unplacedGlyphlings[i];
                _currentDraftGlyphlings.Add(glyphling);

                // If this glyphling is selected and placed on board, don't show in hand
                if (selectedDraft != null &&
                    selectedDraft.Owner == glyphling.Owner &&
                    selectedDraft.Index == glyphling.Index &&
                    GameManager.Instance.PendingDraftPosition != null)
                {
                    continue;
                }

                Vector3 localPos = new Vector3(startX + displayIndex * tileSpacing, 0f, 0f);
                GameObject glyphlingObj = CreateHandGlyphling(glyphling, localPos, i);
                _handGlyphlingObjects.Add(glyphlingObj);
                displayIndex++;
            }

            // Hand is active during draft when it's our turn
            SetHandActive(true);
        }

        private GameObject CreateHandTile(char letter, Vector3 localPos, int index)
        {
            Player displayPlayer = GetDisplayPlayer();
            GameObject tile;

            // Try to use prefab with texture if available
            if (tilePrefab != null && SpriteLoader.Instance != null)
            {
                // Use prefab - rotate to face camera in hand space (hand anchor is rotated 180° on X)
                tile = Instantiate(tilePrefab, Vector3.zero, Quaternion.identity);
                tile.transform.SetParent(_handAnchor);
                tile.transform.localPosition = localPos;
                tile.transform.localRotation = Quaternion.Euler(180f, 0f, 0f); // Flip to face camera
                tile.transform.localScale = new Vector3(tileSize, tileSize, tileSize);

                // Apply runeblossom texture
                var renderer = tile.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.shadowCastingMode = ShadowCastingMode.Off;
                    Material mat = SpriteLoader.Instance.GetRuneblossomMaterial(letter, displayPlayer);
                    if (mat != null)
                    {
                        renderer.material = mat;
                    }
                    else
                    {
                        // Fallback to solid color
                        Material fallback = GetTileMaterial(displayPlayer);
                        if (fallback != null) renderer.material = fallback;
                    }
                }

                // Add collider if not present (for click/drag detection)
                if (tile.GetComponent<Collider>() == null)
                {
                    tile.AddComponent<BoxCollider>();
                }
            }
            else
            {
                // Fallback: cylinder primitive with text
                tile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                tile.transform.SetParent(_handAnchor);
                tile.transform.localPosition = localPos;
                tile.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
                tile.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;

                Material mat = GetTileMaterial(displayPlayer);
                if (mat != null)
                {
                    tile.GetComponent<Renderer>().material = mat;
                }

                CreateLetterText(tile, letter);
            }

            tile.layer = LayerMask.NameToLayer("UI3D");
            tile.name = $"HandTile_{letter}_{index}";

            var clickHandler = tile.AddComponent<HandTileClickHandler>();
            clickHandler.Controller = this;
            clickHandler.Index = index;
            clickHandler.Letter = letter;

            var dragHandler = tile.AddComponent<HandTileDragHandler>();
            dragHandler.Controller = this;
            dragHandler.Index = index;
            dragHandler.Letter = letter;

            return tile;
        }

        private GameObject CreateHandGlyphling(Glyphling glyphling, Vector3 localPos, int index)
        {
            GameObject obj;

            if (glyphlingPrefab != null)
            {
                // Use prefab - rotate to face camera in hand space (hand anchor is rotated 180° on X)
                obj = Instantiate(glyphlingPrefab, Vector3.zero, Quaternion.identity);
                obj.transform.SetParent(_handAnchor);
                obj.transform.localPosition = localPos;
                obj.transform.localScale = new Vector3(tileSize, tileSize, tileSize);
                obj.transform.localRotation = Quaternion.Euler(180f, 0f, 0f); // Flip to face camera

                // Add collider for OnMouseDown detection (Quads don't have colliders by default)
                if (obj.GetComponent<Collider>() == null)
                {
                    obj.AddComponent<BoxCollider>();
                }
            }
            else
            {
                // Fallback to sphere
                obj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                obj.transform.SetParent(_handAnchor);
                obj.transform.localPosition = localPos;
                obj.transform.localScale = new Vector3(tileSize, tileSize, tileSize);

                // Remove collider from primitive
                var collider = obj.GetComponent<Collider>();
                if (collider != null) Destroy(collider);
            }

            var renderer = obj.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.shadowCastingMode = ShadowCastingMode.Off;

                // Use glyphling texture from SpriteLoader, fallback to solid color material
                Material mat = SpriteLoader.Instance?.GetGlyphlingMaterial(glyphling.Owner) ?? GetGlyphlingMaterial(glyphling.Owner);
                if (mat != null)
                {
                    renderer.material = mat;
                }
            }

            obj.layer = LayerMask.NameToLayer("UI3D");
            obj.name = $"HandGlyphling_{glyphling.Owner}_{glyphling.Index}";

            // Add draft drag handler
            var dragHandler = obj.AddComponent<DraftGlyphlingDragHandler>();
            dragHandler.Controller = this;
            dragHandler.Glyphling = glyphling;
            dragHandler.Index = index;

            // Add click handler for tap mode
            var clickHandler = obj.AddComponent<DraftGlyphlingClickHandler>();
            clickHandler.Controller = this;
            clickHandler.Glyphling = glyphling;
            clickHandler.Index = index;

            return obj;
        }

        private void CreateLetterText(GameObject tile, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.15f, 0.15f, 0.15f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 64;
            textMesh.characterSize = 0.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;
        }

        public void OnTileClicked(int index, char letter)
        {
            if (_isInCycleMode)
            {
                ToggleTileForDiscard(index);
                return;
            }

            if (GameManager.Instance.CurrentTurnState != GameTurnState.MovePending &&
                GameManager.Instance.CurrentTurnState != GameTurnState.ReadyToConfirm)
            {
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();
            GameManager.Instance.SelectLetter(letter);
        }

        private void UpdateTileHighlights()
        {
            Player displayPlayer = GetDisplayPlayer();
            for (int i = 0; i < _handTileObjects.Count; i++)
            {
                var tile = _handTileObjects[i];
                var renderer = tile.GetComponent<Renderer>();

                if (i == _selectedIndex && selectedMaterial != null)
                {
                    renderer.material = selectedMaterial;
                }
                else if (i < _currentHand.Count)
                {
                    // Restore runeblossom texture for the letter at this index
                    char letter = _currentHand[i];
                    Material mat = SpriteLoader.Instance?.GetRuneblossomMaterial(letter, displayPlayer) ?? GetTileMaterial(displayPlayer);
                    if (mat != null)
                    {
                        renderer.material = mat;
                    }
                }
            }
        }

        private void UpdateDraftGlyphlingHighlights()
        {
            var state = GameManager.Instance.GameState;
            Player drafter = state.CurrentDrafter;

            for (int i = 0; i < _handGlyphlingObjects.Count; i++)
            {
                var obj = _handGlyphlingObjects[i];
                if (obj == null) continue;

                var renderer = obj.GetComponent<Renderer>();
                if (renderer == null) continue;

                if (i == _selectedDraftIndex && selectedMaterial != null)
                {
                    renderer.material = selectedMaterial;
                }
                else
                {
                    // Restore glyphling texture
                    Material mat = SpriteLoader.Instance?.GetGlyphlingMaterial(drafter) ?? GetGlyphlingMaterial(drafter);
                    if (mat != null)
                    {
                        renderer.material = mat;
                    }
                }
            }
        }

        /// <summary>
        /// Sets the selected tile index (called by drag handler).
        /// </summary>
        public void SetSelectedIndex(int index)
        {
            _selectedIndex = index;
            UpdateTileHighlights();
        }

        /// <summary>
        /// Sets the selected draft glyphling index (called by click/drag handler).
        /// </summary>
        public void SetSelectedDraftIndex(int index)
        {
            _selectedDraftIndex = index;
            UpdateDraftGlyphlingHighlights();
        }

        /// <summary>
        /// Clears the selected draft glyphling index.
        /// </summary>
        public void ClearSelectedDraftIndex()
        {
            _selectedDraftIndex = -1;
            UpdateDraftGlyphlingHighlights();
        }

        /// <summary>
        /// Clears the selected tile index.
        /// </summary>
        public void ClearSelectedIndex()
        {
            _selectedIndex = -1;
            UpdateTileHighlights();
        }



        /// <summary>
        /// Wrapper to show confirm button via GameUIController.
        /// </summary>
        public void ShowConfirmButton()
        {
            GameUIController.Instance?.ShowConfirmButton();
        }

        /// <summary>
        /// Wrapper to hide confirm button via GameUIController.
        /// </summary>
        public void HideConfirmButton()
        {
            GameUIController.Instance?.HideConfirmButton();
        }

        #endregion

        #region Event Handlers

        private void OnSelectionChanged()
        {
            if (GameManager.Instance.IsInCycleMode && !_isInCycleMode)
            {
                // In online mode, only enter cycle mode if it's our turn to cycle
                if (NetworkedGameManager.Instance != null && NetworkedGameManager.Instance.IsOnlineGame)
                {
                    // Only enter cycle mode if the current player is the local player
                    if (!NetworkedGameManager.Instance.IsLocalPlayerTurn)
                    {
                        // Not our turn - don't enter cycle mode on our side
                        return;
                    }
                }
                EnterCycleMode();
                return;
            }

            if (_isInCycleMode)
            {
                return;
            }

            var state = GameManager.Instance.GameState;

            // During draft, hand is always active
            if (state.Phase == GamePhase.Draft)
            {
                if (!_handIsActive)
                {
                    SetHandActive(true);
                }
                return;
            }

            // Check if hand should be active (ready to place a letter)
            var turnState = GameManager.Instance.CurrentTurnState;
            bool shouldBeActive = (turnState == GameTurnState.MovePending);

            if (shouldBeActive && !_handIsActive)
            {
                SetHandActive(true);
            }
            else if (!shouldBeActive && _handIsActive)
            {
                SetHandActive(false);
            }

            if (GameManager.Instance.SelectedGlyphling == null)
            {
                _selectedIndex = -1;
                UpdateTileHighlights();
            }
        }

        private void OnGameEnded(Player? winner)
        {
            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(false);
            }
            foreach (var obj in _handGlyphlingObjects)
            {
                obj.SetActive(false);
            }
        }

        private void OnGameRestarted()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();

            // Reset hand to inactive state
            _handIsActive = false;
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);

            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(true);
            }
            foreach (var obj in _handGlyphlingObjects)
            {
                obj.SetActive(true);
            }

            RefreshHand();
        }

        #endregion

        #region Cycle Mode

        private void EnterCycleMode()
        {
            _isInCycleMode = true;
            _selectedForDiscard.Clear();

            // Tell GameUIController to show confirm button
            if (GameUIController.Instance != null)
            {
                GameUIController.Instance.ShowConfirmButton();
                GameUIController.Instance.HideCancelButton();
            }

            // Hand is active in cycle mode
            SetHandActive(true);
        }

        private void ToggleTileForDiscard(int index)
        {
            var tile = _handTileObjects[index];

            if (_selectedForDiscard.Contains(index))
            {
                // Deselecting - return to normal position and scale
                _selectedForDiscard.Remove(index);
                tile.transform.localPosition += new Vector3(0f, 0.3f, 0f);
                // Restore normal scale - uniform for quad prefabs
                tile.transform.localScale = new Vector3(tileSize, tileSize, tileSize);
            }
            else
            {
                // Selecting - move down and scale up slightly
                _selectedForDiscard.Add(index);
                tile.transform.localPosition -= new Vector3(0f, 0.3f, 0f);
                // Scale up uniformly for quad prefabs (not flat like cylinder fallback)
                float selectedSize = tileSize * 1.15f;
                tile.transform.localScale = new Vector3(selectedSize, selectedSize, selectedSize);
            }
        }

        /// <summary>
        /// Called by GameUIController when confirm is clicked during cycle mode.
        /// </summary>
        public void ConfirmCycleDiscard()
        {
            // In online mode, send to network first
            if (NetworkedGameManager.Instance != null &&
                NetworkedGameManager.Instance.IsOnlineGame)
            {
                // Build discard mask
                byte discardMask = 0;
                foreach (int index in _selectedForDiscard)
                {
                    discardMask |= (byte)(1 << index);
                }

                Debug.Log($"[HandController] Sending cycle to network: mask={discardMask}");
                NetworkedGameManager.Instance.SendCycleToNetwork(discardMask);

                // Exit cycle mode UI immediately (network will handle the actual discard)
                ExitCycleMode();
                return;
            }

            // Local mode - apply immediately
            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];
            var toDiscard = new List<char>();

            foreach (int index in _selectedForDiscard)
            {
                toDiscard.Add(_currentHand[index]);
            }

            foreach (char letter in toDiscard)
            {
                hand.Remove(letter);
            }

            while (hand.Count < GameRules.HandSize && state.TileBag.Count > 0)
            {
                GameRules.DrawTile(state, state.CurrentPlayer);
            }
            ExitCycleMode();
            GameManager.Instance.EndCycleMode();
        }

        private void ExitCycleMode()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();

            if (GameUIController.Instance != null)
            {
                GameUIController.Instance.HideConfirmButton();
            }

            // Hand returns to inactive state
            SetHandActive(false);
        }

        #endregion
    }

    /// <summary>
    /// Handles clicks on hand tiles.
    /// </summary>
    public class HandTileClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public int Index { get; set; }
        public char Letter { get; set; }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            if (!GameManager.Instance.IsInCycleMode &&
                GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            // Block input if it's not the local player's turn in online mode
            if (NetworkedGameManager.Instance != null &&
                NetworkedGameManager.Instance.IsOnlineGame &&
                !NetworkedGameManager.Instance.IsLocalPlayerTurn)
                return;

            Controller?.OnTileClicked(Index, Letter);
        }
    }

    /// <summary>
    /// Handles clicks on draft glyphlings in hand (tap mode).
    /// </summary>
    public class DraftGlyphlingClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public Glyphling Glyphling { get; set; }
        public int Index { get; set; }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            if (GameManager.Instance.GameState.Phase != GamePhase.Draft)
                return;

            // Block input if it's not the local player's turn in online mode
            if (NetworkedGameManager.Instance != null &&
                NetworkedGameManager.Instance.IsOnlineGame &&
                !NetworkedGameManager.Instance.IsLocalPlayerTurn)
                return;

            GameManager.Instance.SelectDraftGlyphlingFromHand(Glyphling);
            Controller.SetSelectedDraftIndex(Index);
        }
    }

    /// <summary>
    /// Handles dragging draft glyphlings from hand to board.
    /// </summary>
    public class DraftGlyphlingDragHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public Glyphling Glyphling { get; set; }
        public int Index { get; set; }

        private bool _isDragging;
        private Vector3 _originalPosition;
        private Vector3 _originalScale;
        private Quaternion _originalRotation;
        private Transform _originalParent;
        private int _originalLayer;
        private Camera _mainCamera;
        private HexCoord? _hoveredHex;
        private int _dragFingerId = -1;

        private void Start()
        {
            _mainCamera = Camera.main;
            _originalLayer = gameObject.layer;
        }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Drag)
                return;

            if (GameManager.Instance.GameState.Phase != GamePhase.Draft)
                return;

            // Block input if it's not the local player's turn in online mode
            if (NetworkedGameManager.Instance != null &&
                NetworkedGameManager.Instance.IsOnlineGame &&
                !NetworkedGameManager.Instance.IsLocalPlayerTurn)
                return;

            // Save original transform
            _originalPosition = transform.position;
            _originalScale = transform.localScale;
            _originalRotation = transform.localRotation;
            _originalParent = transform.parent;
            _originalLayer = gameObject.layer;

            // Unparent so it moves in world space
            transform.SetParent(null);

            // Switch to Board layer so Main Camera renders it during drag
            SetLayerRecursively(gameObject, LayerMask.NameToLayer("Board"));

            // Select this glyphling (shows valid placements)
            GameManager.Instance.SelectDraftGlyphlingFromHand(Glyphling);

            _isDragging = true;

            // Capture which finger started this drag
            _dragFingerId = -1;  // -1 means mouse
            if (Input.touchCount > 0)
            {
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch t = Input.GetTouch(i);
                    if (t.phase == TouchPhase.Began)
                    {
                        _dragFingerId = t.fingerId;
                        break;
                    }
                }
            }
        }

        private void Update()
        {
            if (!_isDragging) return;

            Vector3 screenPos = Input.mousePosition;
            bool fingerReleased = false;

            if (_dragFingerId >= 0)
            {
                // Touch input - find our specific finger
                bool foundFinger = false;
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch t = Input.GetTouch(i);
                    if (t.fingerId == _dragFingerId)
                    {
                        foundFinger = true;
                        screenPos = t.position;

                        if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                        {
                            fingerReleased = true;
                        }
                        break;
                    }
                }

                if (!foundFinger)
                {
                    fingerReleased = true;
                }
                else if (!fingerReleased)
                {
                    UpdateDragPosition(screenPos);
                }
            }
            else
            {
                // Mouse input
                UpdateDragPosition(screenPos);

                if (Input.GetMouseButtonUp(0))
                {
                    fingerReleased = true;
                }
            }

            if (fingerReleased)
            {
                EndDrag();
            }
        }

        private void UpdateDragPosition(Vector3 screenPos)
        {
            Vector3 mouseWorldPos = InputUtility.GetMouseWorldPosition(_mainCamera);

            // Apply vertical offset
            float offset = GameSettings.GetDragOffsetWorld();
            transform.position = new Vector3(
                mouseWorldPos.x,
                0.5f,
                mouseWorldPos.z + offset
            );

            UpdateHoverHighlight(mouseWorldPos + new Vector3(0, 0, offset));
        }

        private void UpdateHoverHighlight(Vector3 worldPos)
        {
            if (BoardRenderer.Instance == null) return;

            HexCoord? newHoveredHex = BoardRenderer.Instance.WorldToHex(worldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show highlight if over a valid draft position
                if (_hoveredHex != null && GameManager.Instance.ValidDraftPlacements.Contains(_hoveredHex.Value))
                {
                    BoardRenderer.Instance.SetHoverHighlight(_hoveredHex.Value);
                }
                else
                {
                    BoardRenderer.Instance.ClearHoverHighlight();
                }
            }
        }

        private void EndDrag()
        {
            _isDragging = false;
            BoardRenderer.Instance?.ClearHoverHighlight();

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidDraftPlacements.Contains(_hoveredHex.Value))
            {
                Debug.Log($"[DraftGlyphlingDragHandler] EndDrag: Valid drop at {_hoveredHex.Value}, passing '{gameObject.name}' to ShowGhostGlyphling");

                // Remove this object from HandController's tracking BEFORE SelectDraftPosition
                // triggers RefreshHand (which would destroy tracked objects)
                Controller.UntrackGlyphlingObject(gameObject);

                // Valid drop - pass this object to board as the ghost (same object, no destroy/recreate)
                BoardRenderer.Instance.ShowGhostGlyphling(
                    _hoveredHex.Value,
                    Glyphling.Owner,
                    gameObject);

                Debug.Log($"[DraftGlyphlingDragHandler] EndDrag: After ShowGhostGlyphling, gameObject null? {gameObject == null}");

                // Now set the pending draft position in GameManager
                GameManager.Instance.SelectDraftPosition(_hoveredHex.Value);

                // Show confirm/cancel buttons
                if (GameUIController.Instance != null)
                {
                    GameUIController.Instance.ShowConfirmButton();
                    GameUIController.Instance.ShowCancelButton();
                }
            }
            else
            {
                // Invalid drop - return to hand
                ReturnToHand();
                GameManager.Instance.CancelDraftPlacement();
            }

            _hoveredHex = null;
        }

        private void ReturnToHand()
        {
            transform.SetParent(_originalParent);
            transform.position = _originalPosition;
            transform.localScale = _originalScale;
            transform.localRotation = _originalRotation;

            // Restore to UI3D layer
            SetLayerRecursively(gameObject, LayerMask.NameToLayer("UI3D"));
        }

        private void SetLayerRecursively(GameObject obj, int layer)
        {
            obj.layer = layer;
            foreach (Transform child in obj.transform)
            {
                SetLayerRecursively(child.gameObject, layer);
            }
        }
    }
}