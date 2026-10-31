
from odoo import api, fields, models
from odoo.exceptions import UserError,ValidationError
import math

class MechanicalFusionBondSteel(models.Model):
    _name = "mechanical.fusion.bond.steel"
    _inherit = "lerm.eln"
    _rec_name = "name"

    name = fields.Char("Name",default="Fusion Bond Epoxy Coated Steel")
    parameter_id = fields.Many2one('eln.parameters.result',string="Parameter")
    sample_parameters = fields.Many2many('lerm.parameter.master',string="Parameters",compute="_compute_sample_parameters",store=True)
    eln_ref = fields.Many2one('lerm.eln',string="ELN")
    eln_state = fields.Selection(related='eln_ref.state', string="ELN State", store=True)


    dia = fields.Char("DIA, mm")
    coating_thickness = fields.Char("Coating Thickness")
    continuity_coating = fields.Selection(
        [('satisfactory', 'Satisfactory'),
         ('unsatisfactory', 'UnSatisfactory')],
        string='Continuity of Coating',
        help='Choose an option from the list.'
    )

    adhesion_coating = fields.Selection(
        [('satisfactory', 'Satisfactory'),
         ('unsatisfactory', 'UnSatisfactory')],
        string='Adhesion of coating',
        help='Choose an option from the list.'
    )