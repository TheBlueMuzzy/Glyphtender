using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Axial coordinate for flat-top hexagonal grid.
    /// Uses (q, r) axial coordinates where q is column, r is row.
    /// </summary>
    public struct HexCoord : IEquatable<HexCoord>
    {
        public readonly int Q;
        public readonly int R;

        public HexCoord(int q, int r)
        {
            Q = q;
            R = r;
        }

        // Cube coordinate S (derived from q and r)
        public int S => -Q - R;

        // Neighbor offsets for flat-top hex grid with offset columns
        // Even columns (0, 2, 4...) and odd columns (1, 3, 5...) have different offsets
        public static readonly HexCoord[] DirectionsEvenCol = new HexCoord[]
        {
            new HexCoord(0, -1),   // North
            new HexCoord(1, -1),   // Northeast (up-right)
            new HexCoord(1, 0),    // Southeast (down-right)
            new HexCoord(0, 1),    // South
            new HexCoord(-1, 0),   // Southwest (down-left)
            new HexCoord(-1, -1)   // Northwest (up-left)
        };

        public static readonly HexCoord[] DirectionsOddCol = new HexCoord[]
        {
            new HexCoord(0, -1),   // North
            new HexCoord(1, 0),    // Northeast (up-right)
            new HexCoord(1, 1),    // Southeast (down-right)
            new HexCoord(0, 1),    // South
            new HexCoord(-1, 1),   // Southwest (down-left)
            new HexCoord(-1, 0)    // Northwest (up-left)
        };

        public HexCoord GetNeighbor(int direction)
        {
            var dirs = (Q % 2 == 0) ? DirectionsEvenCol : DirectionsOddCol;
            var dir = dirs[direction % 6];
            return new HexCoord(Q + dir.Q, R + dir.R);
        }

        public IEnumerable<HexCoord> GetAllNeighbors()
        {
            for (int i = 0; i < 6; i++)
            {
                yield return GetNeighbor(i);
            }
        }

        public int DistanceTo(HexCoord other)
        {
            return (Math.Abs(Q - other.Q) + Math.Abs(R - other.R) + Math.Abs(S - other.S)) / 2;
        }

        public static HexCoord operator +(HexCoord a, HexCoord b)
        {
            return new HexCoord(a.Q + b.Q, a.R + b.R);
        }

        public static HexCoord operator -(HexCoord a, HexCoord b)
        {
            return new HexCoord(a.Q - b.Q, a.R - b.R);
        }

        public static bool operator ==(HexCoord a, HexCoord b)
        {
            return a.Q == b.Q && a.R == b.R;
        }

        public static bool operator !=(HexCoord a, HexCoord b)
        {
            return !(a == b);
        }

        public bool Equals(HexCoord other)
        {
            return Q == other.Q && R == other.R;
        }

        public override bool Equals(object obj)
        {
            return obj is HexCoord other && Equals(other);
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(Q, R);
        }

        public override string ToString()
        {
            return $"({Q}, {R})";
        }
    }

    /// <summary>
    /// The 92-hex game board with flat-top hexagonal grid.
    /// Handles board shape, valid positions, and leyline detection.
    /// </summary>
    public class Board
    {
        private readonly HashSet<HexCoord> _validHexes;

        // Board dimensions (13 columns x variable rows = 92 hexes)
        public const int Columns = 11;

        public Board()
        {
            _validHexes = new HashSet<HexCoord>();
            InitializeBoard();
        }

        private void InitializeBoard()
        {
            // Column heights: 5,8,9,10,9,10,9,10,9,8,5
            // StartRows: where each column begins (row 0 = bottom)
            int[] columnHeights = { 5, 8, 9, 10, 9, 10, 9, 10, 9, 8, 5 };
            int[] startRows = { 3, 1, 1, 0, 1, 0, 1, 0, 1, 1, 3 };

            for (int col = 0; col < Columns; col++)
            {
                int height = columnHeights[col];
                int rStart = startRows[col];

                for (int row = 0; row < height; row++)
                {
                    _validHexes.Add(new HexCoord(col, rStart + row));
                }
            }
        }

        public bool IsValidHex(HexCoord coord)
        {
            return _validHexes.Contains(coord);
        }

        public IEnumerable<HexCoord> GetAllHexes()
        {
            return _validHexes;
        }

        public int HexCount => _validHexes.Count;

        /// <summary>
        /// Gets valid neighbors (only those within board bounds).
        /// </summary>
        public IEnumerable<HexCoord> GetValidNeighbors(HexCoord coord)
        {
            foreach (var neighbor in coord.GetAllNeighbors())
            {
                if (IsValidHex(neighbor))
                {
                    yield return neighbor;
                }
            }
        }

        /// <summary>
        /// Gets all hexes in a straight line (leyline) from start in given direction.
        /// </summary>
        public List<HexCoord> GetLeyline(HexCoord start, int direction)
        {
            var result = new List<HexCoord>();
            var current = start.GetNeighbor(direction);

            while (IsValidHex(current))
            {
                result.Add(current);
                current = current.GetNeighbor(direction);
            }

            return result;
        }
    }
}