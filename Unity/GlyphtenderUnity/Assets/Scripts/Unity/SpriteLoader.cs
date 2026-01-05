using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Loads and caches sprite textures for glyphlings and runeblossoms at runtime.
    /// Textures are loaded from Resources folder using naming conventions:
    /// - Glyphlings: "Glyphtender_Glyphling-{Color}" (e.g., "Glyphtender_Glyphling-Yellow")
    /// - Runeblossoms: "Glyphtender_{Letter} {color}" (e.g., "Glyphtender_A yellow")
    /// </summary>
    public class SpriteLoader : MonoBehaviour
    {
        public static SpriteLoader Instance { get; private set; }

        // Cache loaded textures to avoid repeated disk reads
        private Dictionary<string, Texture2D> _textureCache = new Dictionary<string, Texture2D>();
        private Dictionary<string, Material> _materialCache = new Dictionary<string, Material>();

        // Base material to clone for texture application (needs transparency support)
        private Material _baseMaterial;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            // Create base material with transparency support
            CreateBaseMaterial();
        }

        private void CreateBaseMaterial()
        {
            // Use Unlit/Transparent shader for proper alpha blending
            // This handles semi-transparent pixels correctly without white edge artifacts
            Shader shader = Shader.Find("Unlit/Transparent");
            if (shader == null)
            {
                // Fallback to Standard with Transparent mode (alpha blend)
                shader = Shader.Find("Standard");
                _baseMaterial = new Material(shader);
                _baseMaterial.SetFloat("_Mode", 3); // Transparent mode (alpha blend)
                _baseMaterial.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                _baseMaterial.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                _baseMaterial.SetInt("_ZWrite", 0);
                _baseMaterial.DisableKeyword("_ALPHATEST_ON");
                _baseMaterial.EnableKeyword("_ALPHABLEND_ON");
                _baseMaterial.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                _baseMaterial.renderQueue = 3000; // Transparent queue
            }
            else
            {
                _baseMaterial = new Material(shader);
            }
            _baseMaterial.color = Color.white;
        }

        /// <summary>
        /// Gets the color name string for a player.
        /// </summary>
        private string GetColorName(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return "yellow";
                case Player.Blue: return "blue";
                case Player.Purple: return "purple";
                case Player.Pink: return "pink";
                default: return "yellow";
            }
        }

        /// <summary>
        /// Gets the capitalized color name for glyphling filenames.
        /// </summary>
        private string GetColorNameCapitalized(Player player)
        {
            switch (player)
            {
                case Player.Yellow: return "Yellow";
                case Player.Blue: return "Blue";
                case Player.Purple: return "Purple";
                case Player.Pink: return "Pink";
                default: return "Yellow";
            }
        }

        #region Glyphling Textures

        /// <summary>
        /// Gets the glyphling texture for a player.
        /// </summary>
        public Texture2D GetGlyphlingTexture(Player player)
        {
            // Filename: Glyphtender_Glyphling-Yellow.png (in Art folder)
            string colorName = GetColorNameCapitalized(player);
            string resourcePath = $"Art/Glyphtender_Glyphling-{colorName}";

            return LoadTexture(resourcePath);
        }

        /// <summary>
        /// Gets a material with the glyphling texture applied.
        /// </summary>
        public Material GetGlyphlingMaterial(Player player)
        {
            string cacheKey = $"glyphling_{player}";

            if (_materialCache.TryGetValue(cacheKey, out Material cached))
            {
                return cached;
            }

            Texture2D texture = GetGlyphlingTexture(player);
            if (texture == null)
            {
                Debug.LogWarning($"[SpriteLoader] Could not load glyphling texture for {player}");
                return null;
            }

            Material mat = new Material(_baseMaterial);
            mat.mainTexture = texture;
            mat.name = $"Glyphling_{player}_Material";

            _materialCache[cacheKey] = mat;
            return mat;
        }

        #endregion

        #region Runeblossom Textures

        /// <summary>
        /// Gets the runeblossom texture for a letter and player color.
        /// </summary>
        public Texture2D GetRuneblossomTexture(char letter, Player player)
        {
            // Filename: Glyphtender_A yellow.png (in Art/Runeblossoms folder)
            string colorName = GetColorName(player);
            string upperLetter = char.ToUpper(letter).ToString();
            string resourcePath = $"Art/Runeblossoms/Glyphtender_{upperLetter} {colorName}";

            return LoadTexture(resourcePath);
        }

        /// <summary>
        /// Gets a material with the runeblossom texture applied.
        /// </summary>
        public Material GetRuneblossomMaterial(char letter, Player player)
        {
            string cacheKey = $"runeblossom_{letter}_{player}";

            if (_materialCache.TryGetValue(cacheKey, out Material cached))
            {
                return cached;
            }

            Texture2D texture = GetRuneblossomTexture(letter, player);
            if (texture == null)
            {
                Debug.LogWarning($"[SpriteLoader] Could not load runeblossom texture for '{letter}' {player}");
                return null;
            }

            Material mat = new Material(_baseMaterial);
            mat.mainTexture = texture;
            mat.name = $"Runeblossom_{letter}_{player}_Material";

            _materialCache[cacheKey] = mat;
            return mat;
        }

        #endregion

        #region Texture Loading

        /// <summary>
        /// Loads a texture from Resources folder, with caching.
        /// </summary>
        private Texture2D LoadTexture(string resourcePath)
        {
            if (_textureCache.TryGetValue(resourcePath, out Texture2D cached))
            {
                return cached;
            }

            Texture2D texture = Resources.Load<Texture2D>(resourcePath);

            if (texture == null)
            {
                Debug.LogWarning($"[SpriteLoader] Failed to load texture at: Resources/{resourcePath}");
                return null;
            }

            _textureCache[resourcePath] = texture;
            Debug.Log($"[SpriteLoader] Loaded texture: {resourcePath}");
            return texture;
        }

        #endregion

        #region Utility

        /// <summary>
        /// Clears the texture and material cache (call on scene unload if needed).
        /// </summary>
        public void ClearCache()
        {
            _textureCache.Clear();

            foreach (var mat in _materialCache.Values)
            {
                if (mat != null)
                {
                    Destroy(mat);
                }
            }
            _materialCache.Clear();
        }

        /// <summary>
        /// Ensures a SpriteLoader instance exists in the scene.
        /// </summary>
        public static void EnsureExists()
        {
            if (Instance == null)
            {
                var go = new GameObject("SpriteLoader");
                go.AddComponent<SpriteLoader>();
            }
        }

        #endregion
    }
}
