using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Renders the hex board, tiles, and glyphlings.
    /// 
    /// Responsibilities:
    /// - Creating and managing hex GameObjects
    /// - Creating and managing tile GameObjects
    /// - Creating and managing glyphling GameObjects
    /// - Highlight management (valid moves, casts, hover)
    /// - Ghost tile display
    /// 
    /// Input handling is delegated to HexClickHandler and HexDragHandler.
    /// Coordinate conversion is delegated to HexCoordConverter.
    /// </summary>
    public class BoardRenderer : MonoBehaviour
    {
        public static BoardRenderer Instance { get; private set; }

        [Header("Prefabs")]
        public GameObject hexPrefab;
        public GameObject tilePrefab;
        public GameObject glyphlingPrefab;

        [Header("Materials")]
        public Material hexDefaultMaterial;
        public Material hexHighlightMaterial;
        public Material hexValidMoveMaterial;
        public Material hexValidCastMaterial;
        public Material yellowMaterial;
        public Material blueMaterial;
        public Material yellowCastMaterial;
        public Material blueCastMaterial;
        public Material purpleMaterial;
        public Material pinkMaterial;
        public Material purpleCastMaterial;
        public Material pinkCastMaterial;
        public Material hexHoverMaterial;

        [Header("Settings")]
        [Tooltip("Size of each hex (when equal to hexSpacing, they touch)")]
        public float hexSize = 0.9f;

        [Tooltip("Distance between hex centers")]
        public float hexSpacing = 1f;

        [Tooltip("Size of glyphling spheres (relative to hexSize)")]
        public float glyphlingSize = 1.5f;

        [Header("Animation")]
        public float moveDuration = 0.5f;
        public float resetDuration = 0.05f;
        public float tileCastDuration = 0.3f;
        public float tileResetDuration = 0.1f;

        private Dictionary<Glyphling, Vector3> _glyphlingTargets;

        private HexCoord? _highlightedCastPosition;
        private Vector3 _originalHexScale;

        private HexCoord? _hoverHighlightedHex;
        private Material _originalHoverMaterial;

        private GameObject _ghostTile;
        private bool _ghostTileIsExternal; // True if ghost tile was passed in from hand
        private HexCoord? _ghostTilePosition; // Position where ghost tile is placed
        private Dictionary<Glyphling, bool> _trappedGlyphlings = new Dictionary<Glyphling, bool>();
        private Dictionary<Glyphling, float> _trappedPulseTime = new Dictionary<Glyphling, float>();

        // Rendered objects
        private Dictionary<HexCoord, GameObject> _hexObjects;
        private Dictionary<HexCoord, GameObject> _tileObjects;
        private Dictionary<Glyphling, GameObject> _glyphlingObjects;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            _hexObjects = new Dictionary<HexCoord, GameObject>();
            _tileObjects = new Dictionary<HexCoord, GameObject>();
            _glyphlingObjects = new Dictionary<Glyphling, GameObject>();

            _glyphlingTargets = new Dictionary<Glyphling, Vector3>();

            // Ensure SpriteLoader exists for runtime texture loading
            SpriteLoader.EnsureExists();
        }

        /// <summary>
        /// Gets the material for a player's pieces.
        /// </summary>
        public Material GetPlayerMaterial(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return yellowMaterial;
                case Player.Blue: return blueMaterial;
                case Player.Purple: return purpleMaterial;
                case Player.Pink: return pinkMaterial;
                default: return yellowMaterial;
            }
        }

        /// <summary>
        /// Gets the cast highlight material for a player.
        /// </summary>
        private Material GetPlayerCastMaterial(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return yellowCastMaterial ?? hexValidCastMaterial;
                case Player.Blue: return blueCastMaterial ?? hexValidCastMaterial;
                case Player.Purple: return purpleCastMaterial ?? hexValidCastMaterial;
                case Player.Pink: return pinkCastMaterial ?? hexValidCastMaterial;
                default: return hexValidCastMaterial;
            }
        }

        private void Update()
        {
            // Don't process if game hasn't started yet
            if (GameManager.Instance?.GameState == null) return;

            // Pulse trapped glyphlings
            foreach (var glyphling in _glyphlingObjects.Keys)
            {
                bool isTrapped = TangleChecker.IsTangled(GameManager.Instance.GameState, glyphling);

                if (isTrapped)
                {
                    if (!_trappedPulseTime.ContainsKey(glyphling))
                    {
                        _trappedPulseTime[glyphling] = 0f;
                    }

                    _trappedPulseTime[glyphling] += Time.deltaTime;
                    float pulse = (Mathf.Sin(_trappedPulseTime[glyphling] * 4f) + 1f) / 2f;

                    var renderer = _glyphlingObjects[glyphling].GetComponent<Renderer>();
                    if (renderer != null)
                    {
                        // Get base color from player material (supports all 4 players)
                        var playerMaterial = GetPlayerMaterial(glyphling.Owner);
                        Color baseColor = playerMaterial != null ? playerMaterial.color : Color.white;
                        Color trappedColor = Color.red;
                        renderer.material.color = Color.Lerp(baseColor, trappedColor, pulse * 0.5f);
                    }
                }
                else
                {
                    // Reset color when no longer trapped
                    if (_trappedPulseTime.ContainsKey(glyphling))
                    {
                        _trappedPulseTime.Remove(glyphling);

                        // Restore glyphling texture material
                        var renderer = _glyphlingObjects[glyphling].GetComponent<Renderer>();
                        if (renderer != null)
                        {
                            Material mat = SpriteLoader.Instance?.GetGlyphlingMaterial(glyphling.Owner) ?? GetPlayerMaterial(glyphling.Owner);
                            if (mat != null)
                            {
                                renderer.material = mat;
                            }
                        }
                    }
                }
            }
        }

        private void Start()
        {
            TweenManager.EnsureExists();
            InputStateManager.EnsureExists();

            if (GameManager.Instance != null)
            {
                // Subscribe to game initialized event (for main menu flow)
                GameManager.Instance.OnGameInitialized += OnGameInitialized;
                GameManager.Instance.OnGameStateChanged += RefreshBoard;
                GameManager.Instance.OnSelectionChanged += RefreshHighlights;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;

                // If game is already initialized (no main menu), initialize now
                if (!GameManager.Instance.WaitingForMainMenu && GameManager.Instance.GameState != null)
                {
                    Initialize();
                }
            }
        }

        private void OnGameInitialized()
        {
            Initialize();
        }

        private void Initialize()
        {
            // Initial render
            CreateBoard();
            RefreshBoard();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameInitialized -= OnGameInitialized;
                GameManager.Instance.OnGameStateChanged -= RefreshBoard;
                GameManager.Instance.OnSelectionChanged -= RefreshHighlights;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }
        }

        #region Coordinate Conversion

        /// <summary>
        /// Converts hex coordinates to world position.
        /// Delegates to HexCoordConverter with this renderer's hexSpacing.
        /// </summary>
        public Vector3 HexToWorld(HexCoord hex)
        {
            return HexCoordConverter.HexToWorld(hex, hexSpacing);
        }

        /// <summary>
        /// Converts world position to nearest hex coordinate.
        /// Delegates to HexCoordConverter with this renderer's hexSpacing.
        /// </summary>
        public HexCoord WorldToHex(Vector3 worldPos)
        {
            return HexCoordConverter.WorldToHex(worldPos, hexSpacing);
        }

        #endregion

        #region Board Creation

        /// <summary>
        /// Creates the initial board hexes.
        /// </summary>
        public void CreateBoard()
        {
            if (GameManager.Instance?.GameState == null) return;

            // Clear any existing hexes first
            foreach (var hex in _hexObjects.Values)
            {
                Destroy(hex);
            }
            _hexObjects.Clear();

            var board = GameManager.Instance.GameState.Board;

            foreach (var hex in board.BoardHexes)
            {
                CreateHex(hex);
            }
        }

        private void CreateHex(HexCoord coord)
        {

            GameObject hexObj;

            if (hexPrefab != null)
            {
                hexObj = Instantiate(hexPrefab, HexToWorld(coord), Quaternion.identity, transform);
            }
            else
            {
                // Create simple placeholder cylinder if no prefab
                hexObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                hexObj.transform.position = HexToWorld(coord);
                // Scale by sqrt(3) so that when hexSize == hexSpacing, circles touch
                float visualSize = hexSize * Mathf.Sqrt(3f);
                hexObj.transform.localScale = new Vector3(visualSize, 0.1f, visualSize);
                hexObj.transform.SetParent(transform);

                if (hexDefaultMaterial != null)
                {
                    hexObj.GetComponent<Renderer>().material = hexDefaultMaterial;
                }
            }

            hexObj.name = $"Hex_{coord.Column}_{coord.Row}";

            // Add input handler components
            var clickHandler = hexObj.AddComponent<HexClickHandler>();
            clickHandler.Coord = coord;
            clickHandler.BoardRenderer = this;

            var dragHandler = hexObj.AddComponent<HexDragHandler>();
            dragHandler.Coord = coord;
            dragHandler.BoardRenderer = this;

            _hexObjects[coord] = hexObj;
        }

        #endregion

        #region Board Refresh

        /// <summary>
        /// Refreshes all dynamic elements (tiles, glyphlings).
        /// </summary>
        public void RefreshBoard()
        {
            if (GameManager.Instance?.GameState == null) return;

            RefreshTiles();
            RefreshGlyphlings();
            RefreshHighlights();

            // Show ghost glyphling during draft if position is pending
            // Skip if we already have an external ghost (drag mode handles its own ghost)
            if (GameManager.Instance.GameState.Phase == GamePhase.Draft &&
                GameManager.Instance.PendingDraftPosition.HasValue)
            {
                if (_ghostGlyphling == null)
                {
                    // No ghost yet - create one (tap mode or AI)
                    ShowGhostGlyphling(
                        GameManager.Instance.PendingDraftPosition.Value,
                        GameManager.Instance.GameState.CurrentDrafter);
                }
                // else: ghost already exists (drag mode passed it in), keep it
            }
            else
            {
                HideGhostGlyphling();
            }
        }

        private void RefreshTiles()
        {
            var state = GameManager.Instance.GameState;

            // Remove tiles that no longer exist
            var toRemove = new List<HexCoord>();
            foreach (var kvp in _tileObjects)
            {
                if (!state.Tiles.ContainsKey(kvp.Key))
                {
                    Destroy(kvp.Value);
                    toRemove.Add(kvp.Key);
                }
            }
            foreach (var coord in toRemove)
            {
                _tileObjects.Remove(coord);
            }

            // Add/update tiles
            foreach (var kvp in state.Tiles)
            {
                if (!_tileObjects.ContainsKey(kvp.Key))
                {
                    // Check if a ghost tile exists at this position - if so, confirm it
                    if (_ghostTile != null && _ghostTilePosition == kvp.Key)
                    {
                        ConfirmGhostTile(kvp.Key, kvp.Value);
                    }
                    else
                    {
                        CreateTile(kvp.Key, kvp.Value);
                    }
                }
            }
        }

        private void CreateTile(HexCoord coord, Tile tile)
        {
            // Get the starting position (from the glyphling that cast it)
            Vector3 startPos = HexToWorld(coord) + Vector3.up * 0.15f; // Default
            if (GameManager.Instance.LastCastOrigin != null)
            {
                startPos = HexToWorld(GameManager.Instance.LastCastOrigin.Value) + Vector3.up * 0.3f;
            }

            Vector3 targetPos = HexToWorld(coord) + Vector3.up * 0.15f;

            GameObject tileObj;

            if (tilePrefab != null)
            {
                // Use prefab - rotate 90 degrees on X so quad faces up (like glyphlings)
                tileObj = Instantiate(tilePrefab, startPos, Quaternion.Euler(90f, 0f, 0f), transform);

                // Scale to board tile size
                float tileSize = hexSize * 1.5f;
                tileObj.transform.localScale = new Vector3(tileSize, tileSize, tileSize);

                // Apply runeblossom texture from SpriteLoader
                var renderer = tileObj.GetComponent<Renderer>();
                if (renderer != null && SpriteLoader.Instance != null)
                {
                    Material mat = SpriteLoader.Instance.GetRuneblossomMaterial(tile.Letter, tile.Owner);
                    if (mat != null)
                    {
                        renderer.material = mat;
                        Debug.Log($"[BoardRenderer] Applied runeblossom texture for '{tile.Letter}' {tile.Owner}");
                    }
                    else
                    {
                        // Fallback to solid color material with text
                        var fallbackMat = GetPlayerMaterial(tile.Owner);
                        if (fallbackMat != null)
                        {
                            renderer.material = fallbackMat;
                        }
                        AddLetterTextToTile(tileObj, tile.Letter);
                    }
                }
            }
            else
            {
                // Create cylinder as hex placeholder (matching hand tiles)
                tileObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                tileObj.transform.position = startPos;
                tileObj.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
                tileObj.transform.localScale = new Vector3(hexSize * 1.5f, 0.1f, hexSize * 1.5f);
                tileObj.transform.SetParent(transform);

                // Color by owner
                var material = GetPlayerMaterial(tile.Owner);
                if (material != null)
                {
                    tileObj.GetComponent<Renderer>().material = material;
                }

                AddLetterTextToTile(tileObj, tile.Letter);
            }

            tileObj.name = $"Tile_{tile.Letter}_{coord.Column}_{coord.Row}";

            _tileObjects[coord] = tileObj;

            // Animate tile from cast origin to destination
            TweenManager.Instance.MoveFromTo(tileObj.transform, startPos, targetPos, tileCastDuration);
        }

        /// <summary>
        /// Adds a letter text mesh to a tile (fallback when no texture available).
        /// </summary>
        private void AddLetterTextToTile(GameObject tileObj, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tileObj.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.3f, 0.3f, 0.3f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 32;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;
        }

        private void RefreshGlyphlings()
        {
            var state = GameManager.Instance.GameState;
            foreach (var glyphling in state.Glyphlings)
            {
                // Skip unplaced glyphlings (draft phase)
                if (!glyphling.IsPlaced)
                    continue;

                if (!_glyphlingObjects.ContainsKey(glyphling))
                {
                    CreateGlyphling(glyphling);
                }

                var obj = _glyphlingObjects[glyphling];
                Vector3 targetPos = HexToWorld(glyphling.Position.Value) + Vector3.up * 0.3f;

                // Check if position changed (compare to current target, not current position)
                if (!_glyphlingTargets.ContainsKey(glyphling) || _glyphlingTargets[glyphling] != targetPos)
                {
                    _glyphlingTargets[glyphling] = targetPos;

                    // Use fast duration for reset (snap back), normal for moves
                    float duration = GameManager.Instance.IsResetting ? resetDuration : moveDuration;

                    TweenManager.Instance.MoveTo(obj.transform, targetPos, duration);
                }
            }
        }

        private void CreateGlyphling(Glyphling glyphling)
        {
            GameObject obj;

            if (glyphlingPrefab != null)
            {
                Vector3 spawnPos = HexToWorld(glyphling.Position.Value) + Vector3.up * 0.3f;
                // Rotate 90 degrees on X so quad faces up
                obj = Instantiate(glyphlingPrefab, spawnPos, Quaternion.Euler(90f, 0f, 0f), transform);

                // Scale to board size (same as tiles)
                float size = hexSize * glyphlingSize;
                obj.transform.localScale = new Vector3(size, size, size);

                // Apply glyphling texture from SpriteLoader
                var renderer = obj.GetComponent<Renderer>();
                if (renderer != null && SpriteLoader.Instance != null)
                {
                    Material mat = SpriteLoader.Instance.GetGlyphlingMaterial(glyphling.Owner);
                    if (mat != null)
                    {
                        renderer.material = mat;
                        Debug.Log($"[BoardRenderer] Applied glyphling texture for {glyphling.Owner}");
                    }
                    else
                    {
                        // Fallback to solid color material
                        var fallbackMat = GetPlayerMaterial(glyphling.Owner);
                        if (fallbackMat != null)
                        {
                            renderer.material = fallbackMat;
                        }
                    }
                }
            }
            else
            {
                // Simple placeholder sphere
                obj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Vector3 spawnPos = HexToWorld(glyphling.Position.Value) + Vector3.up * 0.3f;
                obj.transform.position = spawnPos;
                obj.transform.localScale = new Vector3(hexSize * glyphlingSize, hexSize * glyphlingSize, hexSize * glyphlingSize);
                obj.transform.SetParent(transform);

                // Color by owner
                var material = GetPlayerMaterial(glyphling.Owner);
                if (material != null)
                {
                    obj.GetComponent<Renderer>().material = material;
                }

                // Remove collider - selection is handled by hex
                var collider = obj.GetComponent<Collider>();
                if (collider != null)
                {
                    Destroy(collider);
                }
            }

            obj.name = $"Glyphling_{glyphling.Owner}_{glyphling.Index}";

            _glyphlingObjects[glyphling] = obj;
        }

        #endregion

        #region Public Accessors

        /// <summary>
        /// Gets the glyphling at a hex coordinate, if any.
        /// </summary>
        public Glyphling GetGlyphlingAt(HexCoord coord)
        {
            var state = GameManager.Instance?.GameState;
            if (state == null) return null;

            foreach (var g in state.Glyphlings)
            {
                if (g.Position.Equals(coord))
                {
                    return g;
                }
            }
            return null;
        }

        /// <summary>
        /// Gets the GameObject for a glyphling.
        /// </summary>
        public GameObject GetGlyphlingObject(Glyphling glyphling)
        {
            if (glyphling != null && _glyphlingObjects.TryGetValue(glyphling, out var obj))
            {
                return obj;
            }
            return null;
        }

        #endregion

        #region Highlighting

        /// <summary>
        /// Updates hex highlighting based on current selection.
        /// </summary>
        public void RefreshHighlights()
        {
            if (GameManager.Instance == null) return;

            // Reset previously highlighted cast position scale
            if (_highlightedCastPosition != null && _hexObjects.TryGetValue(_highlightedCastPosition.Value, out var prevHex))
            {
                prevHex.transform.localScale = _originalHexScale;
            }
            _highlightedCastPosition = null;

            // Reset all hexes to default (skip hovered hex)
            int resetCount = 0;
            foreach (var kvp in _hexObjects)
            {
                if (_hoverHighlightedHex != null && kvp.Key == _hoverHighlightedHex.Value)
                {
                    continue;
                }

                SetHexMaterial(kvp.Key, hexDefaultMaterial);
                resetCount++;
            }

            // Highlight valid moves (skip hovered hex)
            foreach (var coord in GameManager.Instance.ValidMoves)
            {
                if (_hoverHighlightedHex != null && coord == _hoverHighlightedHex.Value)
                    continue;

                SetHexMaterial(coord, hexValidMoveMaterial);
            }

            // Highlight valid draft placements (only when actively holding a glyphling to place)
            if (GameManager.Instance.GameState.Phase == GamePhase.Draft &&
                GameManager.Instance.SelectedDraftGlyphling != null &&
                !GameManager.Instance.PendingDraftPosition.HasValue)
            {
                foreach (var coord in GameManager.Instance.ValidDraftPlacements)
                {
                    SetHexMaterial(coord, hexValidMoveMaterial);
                }
            }

            // Highlight valid casts with player-specific color
            foreach (var coord in GameManager.Instance.ValidCasts)
            {
                Material castMat = GetPlayerCastMaterial(GameManager.Instance.GameState.CurrentPlayer);
                SetHexMaterial(coord, castMat);
            }

            // Scale up selected cast position
            var pendingCast = GameManager.Instance.PendingCastPosition;
            if (pendingCast != null && _hexObjects.TryGetValue(pendingCast.Value, out var hexObj))
            {
                _originalHexScale = hexObj.transform.localScale;
                _highlightedCastPosition = pendingCast;
                hexObj.transform.localScale = _originalHexScale * 1.3f;
            }
        }


        /// <summary>
        /// Highlights a hex as the current hover/drop target.
        /// </summary>
        public void SetHoverHighlight(HexCoord coord)
        {
            // Clear previous hover
            ClearHoverHighlight();

            if (_hexObjects.TryGetValue(coord, out var hexObj))
            {
                var renderer = hexObj.GetComponent<Renderer>();
                if (renderer != null)
                {
                    _originalHoverMaterial = renderer.material;
                    _hoverHighlightedHex = coord;

                    if (hexHoverMaterial != null)
                    {
                        renderer.material = hexHoverMaterial;
                    }
                }
            }
        }

        /// <summary>
        /// Clears the hover highlight.
        /// </summary>
        public void ClearHoverHighlight()
        {
            if (_hoverHighlightedHex != null && _hexObjects.TryGetValue(_hoverHighlightedHex.Value, out var hexObj))
            {
                var renderer = hexObj.GetComponent<Renderer>();
                if (renderer != null)
                {
                    // Calculate what material this hex SHOULD have based on current state
                    renderer.material = GetHexBaseMaterial(_hoverHighlightedHex.Value);
                }
            }
            _hoverHighlightedHex = null;
            _originalHoverMaterial = null;
        }

        /// <summary>
        /// Determines what material a hex should have based on current game state.
        /// </summary>
        private Material GetHexBaseMaterial(HexCoord coord)
        {
            if (GameManager.Instance == null) return hexDefaultMaterial;

            // Draft placement highlighting (only during draft phase)
            if (GameManager.Instance.GameState.Phase == GamePhase.Draft &&
                GameManager.Instance.ValidDraftPlacements.Contains(coord))
            {
                return hexValidMoveMaterial;
            }

            if (GameManager.Instance.ValidCasts.Contains(coord))
            {
                return GetPlayerCastMaterial(GameManager.Instance.GameState.CurrentPlayer);
            }

            if (GameManager.Instance.ValidMoves.Contains(coord))
            {
                return hexValidMoveMaterial;
            }

            return hexDefaultMaterial;
        }

        private void SetHexMaterial(HexCoord coord, Material material)
        {
            if (_hexObjects.TryGetValue(coord, out var hexObj) && material != null)
            {
                var renderer = hexObj.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.material = material;
                }
            }
        }

        #endregion

        #region Ghost Tile

        /// <summary>
        /// Shows a ghost tile at the pending cast position.
        /// If existingObject is provided, uses that instead of creating a new one.
        /// </summary>
        public void ShowGhostTile(HexCoord position, char letter, Player owner, GameObject existingObject = null)
        {
            // Hide any existing ghost - if it was external, destroy it (it's being replaced)
            var previousGhost = HideGhostTile();
            if (previousGhost != null)
            {
                Debug.Log($"[BoardRenderer] ShowGhostTile: Destroying previous external ghost '{previousGhost.name}'");
                Destroy(previousGhost);
            }

            Vector3 pos = HexToWorld(position) + Vector3.up * 0.2f;
            _ghostTilePosition = position;

            if (existingObject != null)
            {
                // Use the existing object from hand - don't create a new one
                _ghostTile = existingObject;
                _ghostTileIsExternal = true;

                Debug.Log($"[BoardRenderer] ShowGhostTile: Using existing object '{existingObject.name}' at position {pos}");

                // Reparent to board
                _ghostTile.transform.SetParent(transform);
                _ghostTile.transform.position = pos;
                _ghostTile.transform.localRotation = Quaternion.Euler(90f, 0f, 0f); // Board rotation (face up)
                float tileSize = hexSize * 1.5f;
                _ghostTile.transform.localScale = new Vector3(tileSize, tileSize, tileSize);
                _ghostTile.layer = LayerMask.NameToLayer("Board");

                // Set all children to Board layer too
                foreach (Transform child in _ghostTile.transform)
                {
                    child.gameObject.layer = LayerMask.NameToLayer("Board");
                }

                Debug.Log($"[BoardRenderer] Ghost tile placed: pos={_ghostTile.transform.position}, scale={_ghostTile.transform.localScale}, layer={_ghostTile.layer}");
            }
            else
            {
                // Fallback: create a new object (for tap mode or AI)
                _ghostTileIsExternal = false;

                if (tilePrefab != null)
                {
                    _ghostTile = Instantiate(tilePrefab, pos, Quaternion.Euler(90f, 0f, 0f), transform);
                    float tileSize = hexSize * 1.5f;
                    _ghostTile.transform.localScale = new Vector3(tileSize, tileSize, tileSize);
                }
                else
                {
                    _ghostTile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    _ghostTile.transform.position = pos;
                    _ghostTile.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
                    _ghostTile.transform.localScale = new Vector3(hexSize * 1.5f, 0.1f, hexSize * 1.5f);
                    _ghostTile.transform.SetParent(transform);
                }
                _ghostTile.name = "GhostTile";

                // Apply semi-transparent runeblossom texture or fallback material
                var renderer = _ghostTile.GetComponent<Renderer>();
                Material baseMat = SpriteLoader.Instance?.GetRuneblossomMaterial(letter, owner) ?? GetPlayerMaterial(owner);
                Material mat = new Material(baseMat);
                Color c = mat.color;
                c.a = 0.5f;
                mat.color = c;

                // Enable transparency
                mat.SetFloat("_Mode", 3);
                mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                mat.SetInt("_ZWrite", 0);
                mat.DisableKeyword("_ALPHATEST_ON");
                mat.EnableKeyword("_ALPHABLEND_ON");
                mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                mat.renderQueue = 3000;

                renderer.material = mat;

                // Add letter text only for cylinder fallback
                if (tilePrefab == null)
                {
                    AddLetterTextToTile(_ghostTile, letter);
                }
            }
        }

        private GameObject _ghostGlyphling;
        private bool _ghostIsExternal; // True if ghost was passed in from hand (don't destroy it)
        private Material _ghostOriginalMaterial; // To restore opacity on confirm/cancel

        /// <summary>
        /// Shows a ghost glyphling at the pending draft position.
        /// If existingObject is provided, uses that instead of creating a new one.
        /// </summary>
        public void ShowGhostGlyphling(HexCoord position, Player owner, GameObject existingObject = null)
        {
            // Hide any existing ghost - if it was external, destroy it (it's being replaced)
            var previousGhost = HideGhostGlyphling();
            if (previousGhost != null)
            {
                Debug.Log($"[BoardRenderer] ShowGhostGlyphling: Destroying previous external ghost '{previousGhost.name}'");
                Destroy(previousGhost);
            }

            Vector3 pos = HexToWorld(position) + Vector3.up * 0.3f;

            if (existingObject != null)
            {
                // Use the existing object from hand - don't create a new one
                _ghostGlyphling = existingObject;
                _ghostIsExternal = true;

                Debug.Log($"[BoardRenderer] ShowGhostGlyphling: Using existing object '{existingObject.name}' at position {pos}");

                // Reparent to board
                _ghostGlyphling.transform.SetParent(transform);
                _ghostGlyphling.transform.position = pos;
                _ghostGlyphling.transform.localRotation = Quaternion.Euler(90f, 0f, 0f); // Board rotation
                _ghostGlyphling.transform.localScale = new Vector3(hexSize * glyphlingSize, hexSize * glyphlingSize, hexSize * glyphlingSize);
                _ghostGlyphling.layer = LayerMask.NameToLayer("Board");

                Debug.Log($"[BoardRenderer] Ghost placed: pos={_ghostGlyphling.transform.position}, scale={_ghostGlyphling.transform.localScale}, layer={_ghostGlyphling.layer}");

                // Store original material - keep it visible (no transparency, it's confusing)
                var renderer = _ghostGlyphling.GetComponent<Renderer>();
                if (renderer != null)
                {
                    _ghostOriginalMaterial = renderer.material;
                    Debug.Log($"[BoardRenderer] Ghost renderer found, material={renderer.material?.name}");
                }
                else
                {
                    Debug.LogWarning("[BoardRenderer] Ghost has no Renderer component!");
                }
            }
            else
            {
                // Fallback: create a new object (for tap mode or AI)
                _ghostIsExternal = false;

                if (glyphlingPrefab != null)
                {
                    _ghostGlyphling = Instantiate(glyphlingPrefab, pos, Quaternion.Euler(90f, 0f, 0f), transform);
                    _ghostGlyphling.transform.localScale = new Vector3(hexSize * glyphlingSize, hexSize * glyphlingSize, hexSize * glyphlingSize);
                }
                else
                {
                    _ghostGlyphling = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                    _ghostGlyphling.transform.position = pos;
                    _ghostGlyphling.transform.localScale = new Vector3(hexSize * glyphlingSize, hexSize * glyphlingSize, hexSize * glyphlingSize);
                    _ghostGlyphling.transform.SetParent(transform);
                }
                _ghostGlyphling.name = "GhostGlyphling";

                // Apply glyphling texture with semi-transparency
                var renderer = _ghostGlyphling.GetComponent<Renderer>();
                Material baseMat = SpriteLoader.Instance?.GetGlyphlingMaterial(owner) ?? GetPlayerMaterial(owner);
                Material mat = new Material(baseMat);
                Color c = mat.color;
                c.a = 0.5f;
                mat.color = c;

                // Enable transparency
                mat.SetFloat("_Mode", 3);
                mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                mat.SetInt("_ZWrite", 0);
                mat.DisableKeyword("_ALPHATEST_ON");
                mat.EnableKeyword("_ALPHABLEND_ON");
                mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                mat.renderQueue = 3000;

                renderer.material = mat;
                _ghostOriginalMaterial = null;
            }
        }

        /// <summary>
        /// Hides the ghost glyphling. If external, returns the object; otherwise destroys it.
        /// </summary>
        /// <returns>The external ghost object if it was passed in, null otherwise.</returns>
        public GameObject HideGhostGlyphling()
        {
            GameObject result = null;

            if (_ghostGlyphling != null)
            {
                Debug.Log($"[BoardRenderer] HideGhostGlyphling: ghost exists, isExternal={_ghostIsExternal}");
                if (_ghostIsExternal)
                {
                    // Return the object so it can be returned to hand
                    result = _ghostGlyphling;
                    Debug.Log($"[BoardRenderer] HideGhostGlyphling: Returning external ghost '{result.name}'");
                }
                else
                {
                    Debug.Log($"[BoardRenderer] HideGhostGlyphling: Destroying internal ghost");
                    Destroy(_ghostGlyphling);
                }
                _ghostGlyphling = null;
                _ghostIsExternal = false;
                _ghostOriginalMaterial = null;
            }
            else
            {
                Debug.Log("[BoardRenderer] HideGhostGlyphling: No ghost to hide");
            }

            return result;
        }

        /// <summary>
        /// Confirms the ghost glyphling placement - makes it permanent on the board.
        /// The object becomes a real board glyphling (tracked by RefreshGlyphlings).
        /// </summary>
        public void ConfirmGhostGlyphling(Glyphling glyphling)
        {
            if (_ghostGlyphling == null)
            {
                Debug.LogWarning("[BoardRenderer] ConfirmGhostGlyphling: No ghost to confirm!");
                return;
            }
            Debug.Log($"[BoardRenderer] ConfirmGhostGlyphling: Confirming ghost '{_ghostGlyphling.name}' for {glyphling.Owner}_{glyphling.Index}");

            // Apply full opacity glyphling texture
            var renderer = _ghostGlyphling.GetComponent<Renderer>();
            if (renderer != null)
            {
                Material mat = SpriteLoader.Instance?.GetGlyphlingMaterial(glyphling.Owner) ?? GetPlayerMaterial(glyphling.Owner);
                if (mat != null)
                {
                    renderer.material = mat;
                }
            }

            // Remove drag/click handlers that were from the hand
            var dragHandler = _ghostGlyphling.GetComponent<DraftGlyphlingDragHandler>();
            if (dragHandler != null) Destroy(dragHandler);
            var clickHandler = _ghostGlyphling.GetComponent<DraftGlyphlingClickHandler>();
            if (clickHandler != null) Destroy(clickHandler);

            // Remove collider (board glyphlings don't need it - hex handles selection)
            var collider = _ghostGlyphling.GetComponent<Collider>();
            if (collider != null) Destroy(collider);

            // Track it as a real glyphling
            _glyphlingObjects[glyphling] = _ghostGlyphling;
            _ghostGlyphling.name = $"Glyphling_{glyphling.Owner}_{glyphling.Index}";

            // Clear ghost reference (object is now tracked in _glyphlingObjects)
            _ghostGlyphling = null;
            _ghostIsExternal = false;
            _ghostOriginalMaterial = null;
        }

        /// <summary>
        /// Hides the ghost tile. If external, returns the object; otherwise destroys it.
        /// </summary>
        /// <returns>The external ghost object if it was passed in, null otherwise.</returns>
        public GameObject HideGhostTile()
        {
            GameObject result = null;

            if (_ghostTile != null)
            {
                Debug.Log($"[BoardRenderer] HideGhostTile: ghost exists, isExternal={_ghostTileIsExternal}");
                if (_ghostTileIsExternal)
                {
                    // Return the object so it can be returned to hand
                    result = _ghostTile;
                    Debug.Log($"[BoardRenderer] HideGhostTile: Returning external ghost '{result.name}'");
                }
                else
                {
                    Debug.Log($"[BoardRenderer] HideGhostTile: Destroying internal ghost");
                    Destroy(_ghostTile);
                }
                _ghostTile = null;
                _ghostTileIsExternal = false;
                _ghostTilePosition = null;
            }

            return result;
        }

        /// <summary>
        /// Confirms the ghost tile placement - makes it permanent on the board.
        /// The object becomes a real board tile (tracked in _tileObjects).
        /// </summary>
        public void ConfirmGhostTile(HexCoord position, Tile tile)
        {
            if (_ghostTile == null)
            {
                Debug.LogWarning("[BoardRenderer] ConfirmGhostTile: No ghost to confirm!");
                return;
            }
            Debug.Log($"[BoardRenderer] ConfirmGhostTile: Confirming ghost '{_ghostTile.name}' for tile {tile.Letter} at {position}");

            // Apply full opacity runeblossom texture
            var renderer = _ghostTile.GetComponent<Renderer>();
            if (renderer != null)
            {
                Material mat = SpriteLoader.Instance?.GetRuneblossomMaterial(tile.Letter, tile.Owner);
                if (mat != null)
                {
                    renderer.material = mat;
                }
                else
                {
                    // Fallback to solid color material
                    var fallbackMat = GetPlayerMaterial(tile.Owner);
                    if (fallbackMat != null)
                    {
                        renderer.material = fallbackMat;
                    }
                }
            }

            // Remove drag/click handlers that were from the hand
            var dragHandler = _ghostTile.GetComponent<HandTileDragHandler>();
            if (dragHandler != null) Destroy(dragHandler);
            var clickHandler = _ghostTile.GetComponent<HandTileClickHandler>();
            if (clickHandler != null) Destroy(clickHandler);

            // Track it as a real tile
            _tileObjects[position] = _ghostTile;
            _ghostTile.name = $"Tile_{tile.Letter}_{position.Column}_{position.Row}";

            // Clear ghost reference (object is now tracked in _tileObjects)
            _ghostTile = null;
            _ghostTileIsExternal = false;
            _ghostTilePosition = null;
        }

        /// <summary>
        /// Gets whether a ghost tile exists and its position.
        /// </summary>
        public HexCoord? GhostTilePosition => _ghostTilePosition;

        #endregion

        #region Game Events

        private void OnGameRestarted()
        {
            // Clear all hexes (board size may have changed)
            foreach (var hex in _hexObjects.Values)
            {
                Destroy(hex);
            }
            _hexObjects.Clear();

            // Clear all tiles from board
            foreach (var tile in _tileObjects.Values)
            {
                Destroy(tile);
            }
            _tileObjects.Clear();

            // Clear all glyphlings (new ones will be created)
            foreach (var obj in _glyphlingObjects.Values)
            {
                Destroy(obj);
            }
            _glyphlingObjects.Clear();
            _glyphlingTargets.Clear();

            // Clear trapped state
            _trappedPulseTime.Clear();

            // Recreate board with new size
            CreateBoard();

            // Reset highlights
            RefreshHighlights();

            // Refresh board to create new glyphlings
            RefreshBoard();
        }

        /// <summary>
        /// Clears all board visuals (hexes, tiles, glyphlings).
        /// Called when returning to main menu.
        /// </summary>
        public void ClearBoard()
        {
            // Clear all hexes
            foreach (var hex in _hexObjects.Values)
            {
                Destroy(hex);
            }
            _hexObjects.Clear();

            // Clear all tiles
            foreach (var tile in _tileObjects.Values)
            {
                Destroy(tile);
            }
            _tileObjects.Clear();

            // Clear all glyphlings
            foreach (var obj in _glyphlingObjects.Values)
            {
                Destroy(obj);
            }
            _glyphlingObjects.Clear();
            _glyphlingTargets.Clear();

            // Clear trapped state
            _trappedPulseTime.Clear();

            // Hide ghost tile if showing
            HideGhostTile();
        }

        #endregion
    }
}