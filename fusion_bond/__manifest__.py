# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


{
    'name': 'Fusion Bond',
    'version': '1.2',
    'category': 'Lerm Civil',
    'summary': 'Fusion Bond',
    'description': """
This module contains all the common features of Fusion Bond.
    """,
    'depends': ['base','sale','lerm_civil'],
    'data': [
                 'security/ir.model.access.csv',
                 'views/fusion_bond.xml',
                 'reports/fusion_bond_datasheet.xml',
                 'reports/fusion_bond_report.xml'
    ],
    'assets': {
        'web.assets_backend': [
            'fusion_bond/static/src/css/custom_style.css',
        ],
    },
  
    'installable': True,
    'auto_install': False,
   
}
