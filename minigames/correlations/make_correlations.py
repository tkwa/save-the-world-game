#!/usr/bin/env python3
"""
Generate correlation dataset for minigame.
Creates 5 scatterplot images with random correlation values.
"""

import numpy as np
import matplotlib.pyplot as plt
import json
import os
import argparse
from pathlib import Path

def generate_correlated_data(n_points=100, correlation=0.5):
    """Generate 2D data with specified correlation."""
    # Generate independent variables
    x = np.random.randn(n_points)
    noise = np.random.randn(n_points)
    
    # Create correlated y variable
    y = correlation * x + np.sqrt(1 - correlation**2) * noise
    
    return x, y

def create_scatterplot(x, y, filename, correlation):
    """Create and save a scatterplot."""
    plt.figure(figsize=(4, 3), dpi=80)  # Low resolution
    plt.scatter(x, y, alpha=0.6, s=20, color='steelblue')
    plt.xlabel('X')
    plt.ylabel('Y')
    plt.title(f'Data Plot')
    plt.grid(True, alpha=0.3)
    
    # Remove axes values to make it harder to calculate correlation manually
    plt.xticks([])
    plt.yticks([])
    
    plt.tight_layout()
    plt.savefig(filename, bbox_inches='tight', facecolor='white')
    plt.close()

def generate_distractors(true_correlation, min_distance=0.08, max_attempts=1000):
    """Generate 3 distractor answers with minimum distance constraint."""
    distractors = []
    all_values = [true_correlation]  # Start with true value
    
    for _ in range(3):
        attempts = 0
        while attempts < max_attempts:
            # Generate random value between 0 and 1
            candidate = np.random.uniform(0, 1)
            
            # Check if candidate is far enough from all existing values
            min_dist = min(abs(candidate - val) for val in all_values)
            
            if min_dist >= min_distance:
                distractors.append(round(candidate, 3))
                all_values.append(candidate)
                break
            
            attempts += 1
        else:
            # If we can't find a valid distractor after max_attempts,
            # just use a random value (fallback)
            candidate = np.random.uniform(0, 1)
            distractors.append(round(candidate, 3))
            all_values.append(candidate)
    
    return distractors

def test_dataset(data_file):
    """Test existing dataset for minimum distance requirements."""
    if not data_file.exists():
        print(f"Error: {data_file} not found!")
        return False
    
    with open(data_file, 'r') as f:
        data = json.load(f)
    
    print(f"Testing dataset: {data_file}")
    print(f"Description: {data.get('description', 'N/A')}")
    print(f"Number of images: {len(data.get('images', []))}")
    print()
    
    all_valid = True
    
    for img in data.get('images', []):
        filename = img['filename']
        true_corr = img['correlation']
        distractors = img['distractors']
        all_values = [true_corr] + distractors
        
        print(f"{filename}:")
        print(f"  True correlation: {true_corr}")
        print(f"  Distractors: {distractors}")
        
        # Check minimum distance between all pairs
        min_distance = float('inf')
        for i in range(len(all_values)):
            for j in range(i + 1, len(all_values)):
                dist = abs(all_values[i] - all_values[j])
                min_distance = min(min_distance, dist)
        
        meets_requirement = min_distance >= 0.08
        print(f"  Minimum distance: {min_distance:.3f}")
        print(f"  Meets 0.08 requirement: {meets_requirement}")
        
        if not meets_requirement:
            all_valid = False
            print(f"  ❌ FAILED: Distance too small!")
        else:
            print(f"  ✅ PASSED")
        print()
    
    if all_valid:
        print("🎉 All images meet the minimum distance requirement!")
    else:
        print("⚠️  Some images do not meet the minimum distance requirement.")
    
    return all_valid

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Generate or test correlation dataset for minigame')
    parser.add_argument('--test-only', action='store_true', 
                       help='Test existing dataset without generating new one')
    args = parser.parse_args()
    
    # Set up paths
    base_dir = Path(__file__).parent
    images_dir = base_dir / 'images'
    data_file = base_dir / 'data.json'
    
    if args.test_only:
        # Test existing dataset
        test_dataset(data_file)
        return
    
    # Ensure images directory exists
    images_dir.mkdir(exist_ok=True)
    
    # Generate dataset
    dataset = []
    
    for i in range(5):
        # Generate random correlation between 0 and 1
        correlation = np.random.uniform(0, 1)
        
        # Generate correlated data
        x, y = generate_correlated_data(correlation=correlation)
        
        # Create filename
        filename = f'plot_{i+1}.png'
        filepath = images_dir / filename
        
        # Create and save scatterplot
        create_scatterplot(x, y, filepath, correlation)
        
        # Generate distractor answers
        distractors = generate_distractors(correlation)
        
        # Store metadata
        dataset.append({
            'filename': filename,
            'correlation': round(correlation, 3),
            'distractors': distractors
        })
        
        print(f"Generated {filename} with correlation {correlation:.3f}")
    
    # Save dataset metadata
    with open(data_file, 'w') as f:
        json.dump({
            'images': dataset,
            'description': 'Correlation estimation minigame dataset'
        }, f, indent=2)
    
    print(f"\nDataset saved to {data_file}")
    print(f"Images saved to {images_dir}")

if __name__ == '__main__':
    main()