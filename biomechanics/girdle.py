"""Independent scapular controls, assembled with the source AC constraint."""
import math
import opensim as osim

CONTROLS = [
    dict(id='scapula_abduction', axis='', label='Scapular protraction / retraction',
         detail='Increasing = protraction around the thorax; decreasing = retraction', min=-30, max=5, group='girdle'),
    dict(id='scapula_elevation', axis='', label='Scapular elevation / depression',
         detail='Increasing = elevation; decreasing = depression', min=-10, max=10, group='girdle'),
    dict(id='scapula_upward_rot', axis='', label='Scapular upward / downward rotation',
         detail='Increasing = upward rotation; decreasing = downward rotation', min=0, max=45, group='girdle'),
]
INDEPENDENT = tuple(c['id'] for c in CONTROLS)
DEPENDENT = ('clav_prot', 'clav_elev', 'scapula_winging')


def assemble(model, coordinates, values):
    state = model.initializeState()
    refs = osim.SimTKArrayCoordinateReference()
    for name, value in values.items():
        coord = coordinates[name]
        coord.setValue(state, value, False)
        if name in INDEPENDENT:
            coord.setLocked(state, True)
        refs.push_back(osim.CoordinateReference(name, osim.Constant(value)))
    # Model.assemble() can reuse obsolete lock conditions and can relax failed
    # constraints. A fresh native solver enforces the requested coordinates and
    # AC connection strictly, without changing the source model properties.
    solver = osim.AssemblySolver(model, refs, float('inf'))
    solver.setAccuracy(1e-10)
    solver.assemble(state)
    model.realizePosition(state)
    errors = state.getQErr()
    if any(abs(errors.get(i)) > 1e-8 for i in range(errors.size())):
        raise ValueError('Shoulder girdle constraint did not close')
    for name in INDEPENDENT:
        if abs(coordinates[name].getValue(state) - values[name]) > math.radians(1e-5):
            raise ValueError('Shoulder girdle did not reach the requested angle')
    return state
