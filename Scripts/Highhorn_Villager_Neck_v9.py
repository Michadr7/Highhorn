"""Apply the accepted native neck/collar restoration only to the Villager."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import Highhorn_Anatomy_Repair_v7 as anatomy
anatomy.OUT=anatomy.BASE/'VillagerNeck_v9'
anatomy.OUT.mkdir(exist_ok=True)
anatomy.build(['man'])
