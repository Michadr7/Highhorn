"""Run the reversible dimension-fit test setup with Blender's Python."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('Highhorn_Male_Commoner_Dimension_Test.py')), run_name='__main__')
