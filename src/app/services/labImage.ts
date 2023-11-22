import { getRepository } from 'typeorm';
import { ErrorCode } from '$enums/index';
import { PagingParams } from '$interfaces/common';
import { returnPaging } from '$helpers/utils';
import { deleteFileByName } from '$middlewares/common';
import LabImage from '$entities/LabImage';

export interface ICreateLabImage {
    image: string,
    order: number
  } 

export async function addImage(req: ICreateLabImage) {
    const image = await  getRepository(LabImage).save({
        image: req.image,
        order: req.order
    });
    return { id: image.id };
}

export async function getGyId(id : number) {
  const image = await getRepository(LabImage).findOne({ id: id});
  if (!image) throw ErrorCode.Lab_Image_Not_Exist;
  return {
    id: image.id,
    image: image,
    order: image.order
  }
}

export async function getListLabImage(params: PagingParams) {
  const labImageRepo = getRepository(LabImage);

  const query = labImageRepo
    .createQueryBuilder('labImage')
    .select(['labImage.id', 'labImage.image', 'labImage.order'])
    .orderBy('labImage.order', 'ASC');

  const total = await query.getCount();
  const data = await query
    .skip(params.skip)
    .take(params.take)
    .getMany();

  return returnPaging(data, total, params);
}

export async function updateLabImage(id: number, req: ICreateLabImage) {
  const labImageRepo = getRepository(LabImage);

  const labImage = await labImageRepo.findOne({ id: id });
  if (!labImage) throw ErrorCode.Lab_Image_Not_Exist;

  if (labImage.image !== req.image) {
    deleteFileByName(labImage.image);
  }

  await labImageRepo.update({
    id: id
  }, {
    image: req.image,
    order: !req.order ? 0 : req.order,
  });
  return {
    id: id,
    image: req.image,
    order: !req.order ? 0 : req.order
  }
}

export async function deleteLabImage(id: number) {
  const labImageRepo = getRepository(LabImage);

  const labImage = await labImageRepo.findOne( {id: id} );
  if (!labImage) throw ErrorCode.Lab_Image_Not_Exist;

  deleteFileByName(labImage.image);
  
  await labImageRepo.delete({
    id: id
  });
  return {id: id};
}