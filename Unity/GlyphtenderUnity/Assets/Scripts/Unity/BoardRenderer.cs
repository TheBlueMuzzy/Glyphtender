using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Renders the hex board, tiles, and glyphlings.
    /// </summary>
    public class BoardRenderer : MonoBehaviour
    {
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

        [Header("Settings")]
        public float hexSize = 1f;

        [Header("Animation")]
        public float moveDuration = 0.5f;
        public float resetDuration = 0.1f;

        private Dictionary<Glyphling, Vector3> _glyphlingTargets;
        private Dictionary<Glyphling, Vector3> _glyphlingStarts;
        private Dictionary<Glyphling, float> _glyphlingLerpTime;
        private Dictionary<Glyphling, float> _glyphlingLerpDuration;

        // Rendered objects
        private Dictionary<HexCoord, GameObject> _hexObjects;
        private Dictionary<HexCoord, GameObject> _tileObjects;
        private Dictionary<Glyphling, GameObject> _glyphlingObjects;

        // Hex geometry constants for flat-top
        private float _hexWidth;
        private float _hexHeight;

        private void Awake()
        {
            _hexObjects = new Dictionary<HexCoord, GameObject>();
            _tileObjects = new Dictionary<HexCoord, GameObject>();
            _glyphlingObjects = new Dictionary<Glyphling, GameObject>();

            _glyphlingTargets = new Dictionary<Glyphling, Vector3>();
            _glyphlingStarts = new Dictionary<Glyphling, Vector3>();
            _glyphlingLerpTime = new Dictionary<Glyphling, float>();
            _glyphlingLerpDuration = new Dictionary<Glyphling, float>();

            // Flat-top hex dimensions
            _hexWidth = hexSize * 2f;
            _hexHeight = hexSize * Mathf.Sqrt(3f);
        }

        private void Update()
        {
            // Lerp glyphlings toward their targets
            foreach (var glyphling in _glyphlingObjects.Keys)
            {
                if (_glyphlingTargets.TryGetValue(glyphling, out Vector3 target))
                {
                    var obj = _glyphlingObjects[glyphling];
                    _glyphlingLerpTime[glyphling] += Time.deltaTime;

                    float duration = _glyphlingLerpDuration.TryGetValue(glyphling, out float d) ? d : moveDuration;
                    float t = Mathf.Clamp01(_glyphlingLerpTime[glyphling] / duration);

                    // Smooth step for nicer easing
                    t = t * t * (3f - 2f * t);

                    Vector3 start = _glyphlingStarts.TryGetValue(glyphling, out Vector3 s) ? s : obj.transform.position;
                    obj.transform.position = Vector3.Lerp(start, target, t);
                }
            }
        }

        private void Start()
        {
            // Delay initialization to ensure GameManager is ready
            Invoke("Initialize", 0.1f);
        }

        private void Initialize()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshBoard;
                GameManager.Instance.OnSelectionChanged += RefreshHighlights;

                // Initial render
                CreateBoard();
                RefreshBoard();

                Debug.Log("BoardRenderer initialized.");
            }
            else
            {
                Debug.LogError("GameManager.Instance is null!");
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshBoard;
                GameManager.Instance.OnSelectionChanged -= RefreshHighlights;
            }
        }

        /// <summary>
        /// Converts hex coordinates to world position.
        /// </summary>
        public Vector3 HexToWorld(HexCoord hex)
        {
            // Flat-top hex layout with independent columns
            float x = hexSize * 1.5f * hex.Q;

            // Offset odd columns by half a hex height
            float zOffset = (hex.Q % 2 == 1) ? hexSize * Mathf.Sqrt(3f) / 2f : 0f;
            float z = hexSize * Mathf.Sqrt(3f) * hex.R + zOffset;

            return new Vector3(x, 0f, z);
        }

        /// <summary>
        /// Converts world position to nearest hex coordinate.
        /// </summary>
        public HexCoord WorldToHex(Vector3 worldPos)
        {
            // Convert to fractional hex coordinates
            float q = (2f / 3f * worldPos.x) / hexSize;
            float r = (-1f / 3f * worldPos.x + Mathf.Sqrt(3f) / 3f * worldPos.z) / hexSize;

            return RoundToHex(q, r);
        }

        private HexCoord RoundToHex(float q, float r)
        {
            float s = -q - r;

            int roundQ = Mathf.RoundToInt(q);
            int roundR = Mathf.RoundToInt(r);
            int roundS = Mathf.RoundToInt(s);

            float qDiff = Mathf.Abs(roundQ - q);
            float rDiff = Mathf.Abs(roundR - r);
            float sDiff = Mathf.Abs(roundS - s);

            if (qDiff > rDiff && qDiff > sDiff)
            {
                roundQ = -roundR - roundS;
            }
            else if (rDiff > sDiff)
            {
                roundR = -roundQ - roundS;
            }

            return new HexCoord(roundQ, roundR);
        }

        /// <summary>
        /// Creates the initial board hexes.
        /// </summary>
        public void CreateBoard()
        {
            if (GameManager.Instance?.GameState == null) return;

            var board = GameManager.Instance.GameState.Board;

            foreach (var hex in board.GetAllHexes())
            {
                CreateHex(hex);
            }

            Debug.Log($"Created {_hexObjects.Count} hex objects.");
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
                hexObj.transform.localScale = new Vector3(hexSize * 0.9f, 0.1f, hexSize * 0.9f);
                hexObj.transform.SetParent(transform);

                if (hexDefaultMaterial != null)
                {
                    hexObj.GetComponent<Renderer>().material = hexDefaultMaterial;
                }
            }

            hexObj.name = $"Hex_{coord.Q}_{coord.R}";

            // Add HexClickHandler component
            var clickHandler = hexObj.AddComponent<HexClickHandler>();
            clickHandler.Coord = coord;

            _hexObjects[coord] = hexObj;
        }

        /// <summary>
        /// Refreshes all dynamic elements (tiles, glyphlings).
        /// </summary>
        public void RefreshBoard()
        {
            if (GameManager.Instance?.GameState == null) return;

            RefreshTiles();
            RefreshGlyphlings();
            RefreshHighlights();
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
                    CreateTile(kvp.Key, kvp.Value);
                }
            }
        }

        private void CreateTile(HexCoord coord, Tile tile)
        {
            GameObject tileObj;

            if (tilePrefab != null)
            {
                tileObj = Instantiate(tilePrefab, HexToWorld(coord) + Vector3.up * 0.15f,
                    Quaternion.identity, transform);
            }
            else
            {
                // Simple placeholder cube
                tileObj = GameObject.CreatePrimitive(PrimitiveType.Cube);
                tileObj.transform.position = HexToWorld(coord) + Vector3.up * 0.15f;
                tileObj.transform.localScale = new Vector3(hexSize * 0.6f, 0.2f, hexSize * 0.6f);
                tileObj.transform.SetParent(transform);

                // Color by owner
                var material = tile.Owner == Player.Yellow ? yellowMaterial : blueMaterial;
                if (material != null)
                {
                    tileObj.GetComponent<Renderer>().material = material;
                }
            }

            tileObj.name = $"Tile_{tile.Letter}_{coord.Q}_{coord.R}";

            // TODO: Add TextMesh for letter display

            _tileObjects[coord] = tileObj;
        }

        private void RefreshGlyphlings()
        {
            var state = GameManager.Instance.GameState;

            foreach (var glyphling in state.Glyphlings)
            {
                if (!_glyphlingObjects.ContainsKey(glyphling))
                {
                    CreateGlyphling(glyphling);
                }

                var obj = _glyphlingObjects[glyphling];
                Vector3 targetPos = HexToWorld(glyphling.Position) + Vector3.up * 0.3f;

                // Check if position changed
                if (!_glyphlingTargets.ContainsKey(glyphling) || _glyphlingTargets[glyphling] != targetPos)
                {
                    _glyphlingStarts[glyphling] = obj.transform.position;
                    _glyphlingTargets[glyphling] = targetPos;
                    _glyphlingLerpTime[glyphling] = 0f;

                    // Use fast duration for reset (snap back), normal for moves
                    _glyphlingLerpDuration[glyphling] = GameManager.Instance.IsResetting ? resetDuration : moveDuration;
                }
            }
        }

        private void CreateGlyphling(Glyphling glyphling)
        {
            GameObject obj;

            if (glyphlingPrefab != null)
            {
                obj = Instantiate(glyphlingPrefab, Vector3.zero, Quaternion.identity, transform);
            }
            else
            {
                // Simple placeholder sphere
                obj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                obj.transform.localScale = new Vector3(hexSize * 0.5f, hexSize * 0.5f, hexSize * 0.5f);
                obj.transform.SetParent(transform);

                // Color by owner
                var material = glyphling.Owner == Player.Yellow ? yellowMaterial : blueMaterial;
                if (material != null)
                {
                    obj.GetComponent<Renderer>().material = material;
                }
            }

            obj.name = $"Glyphling_{glyphling.Owner}_{glyphling.Index}";

            // Add click handler
            var clickHandler = obj.AddComponent<GlyphlingClickHandler>();
            clickHandler.Glyphling = glyphling;

            _glyphlingObjects[glyphling] = obj;
        }

        /// <summary>
        /// Updates hex highlighting based on current selection.
        /// </summary>
        public void RefreshHighlights()
        {
            if (GameManager.Instance == null) return;

            // Reset all hexes to default
            foreach (var kvp in _hexObjects)
            {
                SetHexMaterial(kvp.Key, hexDefaultMaterial);
            }

            // Highlight valid moves
            foreach (var coord in GameManager.Instance.ValidMoves)
            {
                SetHexMaterial(coord, hexValidMoveMaterial);
            }

            // Highlight valid casts
            foreach (var coord in GameManager.Instance.ValidCasts)
            {
                SetHexMaterial(coord, hexValidCastMaterial);
            }
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
    }

    /// <summary>
    /// Handles clicks on hex tiles.
    /// </summary>
    public class HexClickHandler : MonoBehaviour
    {
        public HexCoord Coord { get; set; }

        private void OnMouseDown()
        {
            if (GameManager.Instance == null) return;

            // Determine what action to take based on game state
            if (GameManager.Instance.ValidMoves.Contains(Coord))
            {
                GameManager.Instance.SelectDestination(Coord);
            }
            else if (GameManager.Instance.ValidCasts.Contains(Coord))
            {
                GameManager.Instance.SelectCastPosition(Coord);
            }
        }
    }

    /// <summary>
    /// Handles clicks on glyphlings.
    /// </summary>
    public class GlyphlingClickHandler : MonoBehaviour
    {
        public Glyphling Glyphling { get; set; }

        private void OnMouseDown()
        {
            if (GameManager.Instance == null) return;

            GameManager.Instance.SelectGlyphling(Glyphling);
        }
    }
}